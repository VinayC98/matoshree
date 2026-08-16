import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { CreateMembershipDto } from './dto/create-membership.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma.service.js';
import { RenewMembershipDto } from './dto/renew-membership.dto.js';
import { ChangeMembershipDto } from './dto/change-membership.dto.js';

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createMembership(dto: CreateMembershipDto) {
    try {
      const startDate = new Date(dto.startDate);

      if (Number.isNaN(startDate.getTime())) {
        throw new BadRequestException('Invalid start date');
      }

      const initialPayment = dto.initialPaymentAmount ?? 0;
      const paymentMode = dto.paymentMode ?? 'CASH';

      if (initialPayment < 0) {
        throw new BadRequestException('Payment amount cannot be negative');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        /*
         * 1. Validate student
         */
        const student = await tx.student.findUnique({
          where: {
            id: dto.studentId,
          },
          select: {
            id: true,
            name: true,
            mobile: true,
          },
        });

        if (!student) {
          throw new NotFoundException('Student not found');
        }

        /*
         * 2. Prevent creating another active membership
         */
        const now = new Date();

        const activeMembership = await tx.membership.findFirst({
          where: {
            studentId: dto.studentId,
            isActive: true,
            endDate: {
              gte: now,
            },
          },
          select: {
            id: true,
          },
        });

        if (activeMembership) {
          throw new BadRequestException(
            'Student already has an active membership',
          );
        }

        /*
         * 3. Validate membership plan
         */
        const plan = await tx.membershipPlan.findFirst({
          where: {
            id: dto.membershipPlanId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            code: true,
            requiresFixedSeat: true,
          },
        });

        if (!plan) {
          throw new NotFoundException('Membership plan not found');
        }

        /*
         * 4. Validate shift
         */
        const shift = await tx.shift.findFirst({
          where: {
            id: dto.shiftId,
            isActive: true,
          },
          select: {
            id: true,
            code: true,
            name: true,
          },
        });

        if (!shift) {
          throw new NotFoundException('Shift not found');
        }

        if (
          plan.code === 'HALF' &&
          !['MORNING', 'EVENING'].includes(shift.code)
        ) {
          throw new BadRequestException(
            'Half Time membership only supports Morning or Evening shift',
          );
        }

        if (
          ['FULL', 'FIXED'].includes(plan.code) &&
          shift.code !== 'FULL_DAY'
        ) {
          throw new BadRequestException(
            `${plan.name} membership only supports Full Day shift`,
          );
        }

        /*
         * 5. Get latest active pricing
         */
        const pricing = await tx.pricing.findFirst({
          where: {
            membershipPlanId: plan.id,
            shiftId: shift.id,
            isActive: true,
          },
          orderBy: {
            effectiveFrom: 'desc',
          },
          select: {
            id: true,
            monthlyFee: true,
            registrationFee: true,
            billingCycleDays: true,
          },
        });

        if (!pricing) {
          throw new BadRequestException(
            'Pricing not configured for selected plan and shift',
          );
        }

        /*
         * 6. Calculate current membership period
         */
        const endDate = new Date(startDate);

        endDate.setDate(endDate.getDate() + pricing.billingCycleDays);

        /*
         * 7. Validate + atomically lock fixed seat
         */
        let fixedSeatId: string | null = null;

        if (plan.requiresFixedSeat) {
          if (!dto.fixedSeatId) {
            throw new BadRequestException(
              'Fixed seat is required for this membership plan',
            );
          }

          const seat = await tx.seat.findUnique({
            where: {
              id: dto.fixedSeatId,
            },
            select: {
              id: true,
              isFixedLocked: true,
            },
          });

          if (!seat) {
            throw new NotFoundException('Seat not found');
          }

          /*
           * Atomic lock.
           *
           * If another request has already locked
           * this seat, count will be 0.
           */
          const locked = await tx.seat.updateMany({
            where: {
              id: seat.id,
              isFixedLocked: false,
            },
            data: {
              isFixedLocked: true,
            },
          });

          if (locked.count !== 1) {
            throw new BadRequestException(
              'Selected seat is no longer available',
            );
          }

          fixedSeatId = seat.id;
        }

        /*
         * 8. Calculate current total
         */
        const totalDue = pricing.monthlyFee + pricing.registrationFee;

        /*
         * Phase 1:
         * Do not accept advance payment yet.
         *
         * We only support:
         *   ₹0
         *   partial
         *   full
         */
        if (initialPayment > totalDue) {
          throw new BadRequestException(
            `Initial payment cannot exceed current amount due of ₹${totalDue}. Advance payment will be supported separately.`,
          );
        }

        /*
         * 9. Create membership
         */
        const membership = await tx.membership.create({
          data: {
            studentId: student.id,
            membershipPlanId: plan.id,
            shiftId: shift.id,
            fixedSeatId,

            startDate,
            endDate,

            priceSnapshot: pricing.monthlyFee,

            registrationFee: pricing.registrationFee,

            isActive: true,
          },
        });

        /*
         * 10. Create registration charge
         */
        if (pricing.registrationFee > 0) {
          await tx.membershipCharge.create({
            data: {
              membershipId: membership.id,

              type: 'REGISTRATION',

              amountDue: pricing.registrationFee,

              periodStart: null,
              periodEnd: null,

              dueDate: startDate,

              status: 'PENDING',
            },
          });
        }

        /*
         * 11. Create current membership charge
         */
        await tx.membershipCharge.create({
          data: {
            membershipId: membership.id,

            type: 'MEMBERSHIP',

            amountDue: pricing.monthlyFee,

            periodStart: startDate,
            periodEnd: endDate,

            dueDate: startDate,

            status: 'PENDING',
          },
        });

        /*
         * 12. Create payment if admin entered
         *     an amount greater than zero
         */
        let payment: {
          id: string;
          studentId: string;
          membershipId: string;
          amount: number;
          paymentMode: string;
          paymentType: string;
          paidOn: Date;
        } | null = null;

        if (initialPayment > 0) {
          const createdPayment = await tx.payment.create({
            data: {
              membershipId: membership.id,
              studentId: student.id,
              amount: initialPayment,
              paymentMode,
              paymentType: 'MEMBERSHIP_PAYMENT',
            },
          });

          payment = createdPayment;

          let remaining = initialPayment;

          const charges = await tx.membershipCharge.findMany({
            where: {
              membershipId: membership.id,
              status: {
                in: ['PENDING', 'PARTIAL'],
              },
            },
            orderBy: [
              {
                dueDate: 'asc',
              },
              {
                createdAt: 'asc',
              },
            ],
          });

          for (const charge of charges) {
            if (remaining <= 0) {
              break;
            }

            const allocationTotal = await tx.paymentAllocation.aggregate({
              _sum: {
                amount: true,
              },
              where: {
                chargeId: charge.id,
              },
            });

            const alreadyPaid = allocationTotal._sum.amount ?? 0;

            const outstanding = charge.amountDue - alreadyPaid;

            if (outstanding <= 0) {
              continue;
            }

            const allocationAmount = Math.min(remaining, outstanding);

            await tx.paymentAllocation.create({
              data: {
                paymentId: createdPayment.id,
                chargeId: charge.id,
                amount: allocationAmount,
              },
            });

            const totalPaid = alreadyPaid + allocationAmount;

            await tx.membershipCharge.update({
              where: {
                id: charge.id,
              },
              data: {
                status: totalPaid >= charge.amountDue ? 'PAID' : 'PARTIAL',
              },
            });

            remaining -= allocationAmount;
          }

          if (remaining > 0) {
            throw new BadRequestException('Unable to allocate payment');
          }
        }

        /*
         * 14. Get payment summary
         */
        const chargeSummary = await tx.membershipCharge.findMany({
          where: {
            membershipId: membership.id,
          },
          select: {
            amountDue: true,
            status: true,
            allocations: {
              select: {
                amount: true,
              },
            },
          },
        });

        const totalChargeAmount = chargeSummary.reduce(
          (sum, charge) => sum + charge.amountDue,
          0,
        );

        const totalPaidAmount = chargeSummary.reduce(
          (sum, charge) =>
            sum +
            charge.allocations.reduce(
              (allocationSum, allocation) => allocationSum + allocation.amount,
              0,
            ),
          0,
        );

        const outstandingAmount = totalChargeAmount - totalPaidAmount;

        const paymentStatus =
          totalPaidAmount === 0
            ? 'YET_TO_PAY'
            : totalPaidAmount < totalChargeAmount
              ? 'PARTIAL'
              : 'PAID';

        return {
          membership,
          payment,

          paymentSummary: {
            totalDue: totalChargeAmount,

            totalPaid: totalPaidAmount,

            outstanding: outstandingAmount,

            status: paymentStatus,
          },
        };
      });

      /*
       * 15. Audit outside transaction
       */
      await this.auditService.log({
        action: 'MEMBERSHIP_CREATED',
        entity: 'Membership',
        entityId: result.membership.id,

        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',

        description: 'Membership created successfully',

        meta: {
          membershipId: result.membership.id,

          paymentSummary: result.paymentSummary,
        },
      });

      /*
       * 16. Response
       */
      return {
        message: 'Membership created successfully',

        membership: result.membership,

        payment: result.payment,

        paymentSummary: result.paymentSummary,
      };
    } catch (error) {
      console.error('CREATE MEMBERSHIP ERROR:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create membership');
    }
  }

  async renewMembership(dto: RenewMembershipDto) {
    try {
      const paymentAmount = dto.paymentAmount ?? 0;
      const paymentMode = dto.paymentMode ?? 'CASH';

      if (paymentAmount < 0) {
        throw new BadRequestException('Payment amount cannot be negative');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const membership = await tx.membership.findFirst({
          where: {
            studentId: dto.studentId,
          },
          orderBy: {
            endDate: 'desc',
          },
          include: {
            membershipPlan: {
              select: {
                id: true,
                code: true,
                name: true,
                requiresFixedSeat: true,
              },
            },
            shift: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        });

        if (!membership) {
          throw new NotFoundException('No membership found for this student');
        }

        const plan = membership.membershipPlan;
        const shift = membership.shift;

        if (
          plan.code === 'HALF' &&
          !['MORNING', 'EVENING'].includes(shift.code)
        ) {
          throw new BadRequestException(
            'Half Time membership only supports Morning or Evening shift',
          );
        }

        if (
          ['FULL', 'FIXED'].includes(plan.code) &&
          shift.code !== 'FULL_DAY'
        ) {
          throw new BadRequestException(
            `${plan.name} membership only supports Full Day shift`,
          );
        }

        const pricing = await tx.pricing.findFirst({
          where: {
            membershipPlanId: membership.membershipPlanId,
            shiftId: membership.shiftId,
            isActive: true,
          },
          orderBy: {
            effectiveFrom: 'desc',
          },
          select: {
            id: true,
            monthlyFee: true,
            registrationFee: true,
            billingCycleDays: true,
          },
        });

        if (!pricing) {
          throw new BadRequestException(
            'Pricing not configured for this membership plan and shift',
          );
        }

        const renewalAmount = pricing.monthlyFee;
        const now = new Date();

        /*
         * Reuse an existing future renewal charge.
         *
         * This prevents a second ₹350 charge from being created when
         * the student already has a partially-paid renewal.
         */
        const existingFutureCharges = await tx.membershipCharge.findMany({
          where: {
            membershipId: membership.id,
            type: 'MEMBERSHIP',
            status: {
              in: ['PENDING', 'PARTIAL'],
            },
            periodStart: {
              gt: now,
            },
          },
          include: {
            allocations: {
              select: {
                amount: true,
              },
            },
          },
          orderBy: [
            {
              periodStart: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        });

        let renewalCharge = existingFutureCharges[0] ?? null;
        let updatedMembership = membership;

        if (!renewalCharge) {
          const renewalStart =
            membership.endDate > now
              ? new Date(membership.endDate)
              : new Date(now);

          const renewalEnd = new Date(renewalStart);
          renewalEnd.setDate(renewalEnd.getDate() + pricing.billingCycleDays);

          renewalCharge = await tx.membershipCharge.create({
            data: {
              membershipId: membership.id,
              type: 'MEMBERSHIP',
              amountDue: renewalAmount,
              periodStart: renewalStart,
              periodEnd: renewalEnd,
              dueDate: renewalStart,
              status: 'PENDING',
            },
            include: {
              allocations: {
                select: {
                  amount: true,
                },
              },
            },
          });

          updatedMembership = await tx.membership.update({
            where: {
              id: membership.id,
            },
            data: {
              endDate: renewalEnd,
              priceSnapshot: pricing.monthlyFee,
              isActive: true,
            },
            include: {
              membershipPlan: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  requiresFixedSeat: true,
                },
              },
              shift: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          });
        }

        const alreadyPaid = renewalCharge.allocations.reduce(
          (sum, allocation) => sum + allocation.amount,
          0,
        );

        const renewalOutstanding = Math.max(
          renewalCharge.amountDue - alreadyPaid,
          0,
        );

        if (paymentAmount > renewalOutstanding) {
          throw new BadRequestException(
            `Payment cannot exceed renewal outstanding amount of ₹${renewalOutstanding}`,
          );
        }

        let payment: {
          id: string;
          studentId: string;
          membershipId: string;
          amount: number;
          paymentMode: string;
          paymentType: string;
          paidOn: Date;
        } | null = null;

        if (paymentAmount > 0) {
          const createdPayment = await tx.payment.create({
            data: {
              membershipId: membership.id,
              studentId: membership.studentId,
              amount: paymentAmount,
              paymentMode,
              paymentType: 'MEMBERSHIP_PAYMENT',
            },
          });

          payment = createdPayment;

          const totalPaidForCharge = alreadyPaid + paymentAmount;

          await tx.paymentAllocation.create({
            data: {
              paymentId: createdPayment.id,
              chargeId: renewalCharge.id,
              amount: paymentAmount,
            },
          });

          await tx.membershipCharge.update({
            where: {
              id: renewalCharge.id,
            },
            data: {
              status:
                totalPaidForCharge >= renewalCharge.amountDue
                  ? 'PAID'
                  : 'PARTIAL',
            },
          });
        }

        const finalRenewalPaid = alreadyPaid + paymentAmount;

        const finalRenewalOutstanding = Math.max(
          renewalCharge.amountDue - finalRenewalPaid,
          0,
        );

        const renewalStatus =
          finalRenewalPaid === 0
            ? 'YET_TO_PAY'
            : finalRenewalOutstanding === 0
              ? 'PAID'
              : 'PARTIAL';

        const allCharges = await tx.membershipCharge.findMany({
          where: {
            membershipId: membership.id,
            status: {
              not: 'CANCELLED',
            },
          },
          include: {
            allocations: {
              select: {
                amount: true,
              },
            },
          },
          orderBy: [
            {
              dueDate: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        });

        const totalDue = allCharges.reduce(
          (sum, charge) => sum + charge.amountDue,
          0,
        );

        const totalPaid = allCharges.reduce(
          (sum, charge) =>
            sum +
            charge.allocations.reduce(
              (allocationSum, allocation) => allocationSum + allocation.amount,
              0,
            ),
          0,
        );

        const outstanding = Math.max(totalDue - totalPaid, 0);

        const status =
          totalPaid === 0
            ? 'YET_TO_PAY'
            : outstanding === 0
              ? 'PAID'
              : 'PARTIAL';

        return {
          membership: updatedMembership,
          renewalCharge,
          payment,
          paymentSummary: {
            renewalAmount: renewalCharge.amountDue,
            renewalPaid: finalRenewalPaid,
            renewalOutstanding: finalRenewalOutstanding,
            renewalStatus,
            totalDue,
            totalPaid,
            outstanding,
            status,
          },
        };
      });

      await this.auditService.log({
        action: 'MEMBERSHIP_RENEWED',
        entity: 'Membership',
        entityId: result.membership.id,
        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',
        description: 'Membership renewed successfully',
        meta: {
          membershipId: result.membership.id,
          renewalChargeId: result.renewalCharge.id,
          paymentId: result.payment?.id ?? null,
          paymentSummary: result.paymentSummary,
        },
      });

      return {
        message: 'Membership renewed successfully',
        membership: result.membership,
        renewalCharge: result.renewalCharge,
        payment: result.payment,
        paymentSummary: result.paymentSummary,
      };
    } catch (error) {
      console.error('RENEW MEMBERSHIP ERROR:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to renew membership');
    }
  }

  async changeMembership(dto: ChangeMembershipDto) {
    try {
      const paymentAmount = dto.initialPaymentAmount ?? 0;

      const paymentMode = dto.paymentMode ?? 'CASH';

      if (paymentAmount < 0) {
        throw new BadRequestException('Payment amount cannot be negative');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        /*
         * =================================================
         * 1. FIND CURRENT ACTIVE MEMBERSHIP
         * =================================================
         */

        const currentMembership = await tx.membership.findFirst({
          where: {
            studentId: dto.studentId,

            isActive: true,

            endDate: {
              gte: new Date(),
            },
          },

          orderBy: {
            endDate: 'desc',
          },

          include: {
            membershipPlan: {
              select: {
                id: true,
                code: true,
                name: true,
                requiresFixedSeat: true,
                isSeatDailyAssigned: true,
              },
            },

            shift: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            fixedSeat: {
              select: {
                id: true,
                seatNumber: true,
                labId: true,
              },
            },
          },
        });

        if (!currentMembership) {
          throw new NotFoundException(
            'Student does not have an active membership',
          );
        }

        /*
         * =================================================
         * 2. VALIDATE NEW PLAN
         * =================================================
         */

        const newPlan = await tx.membershipPlan.findFirst({
          where: {
            id: dto.membershipPlanId,
            isActive: true,
          },

          select: {
            id: true,
            code: true,
            name: true,
            requiresFixedSeat: true,
            isSeatDailyAssigned: true,
          },
        });

        if (!newPlan) {
          throw new NotFoundException('New membership plan not found');
        }

        /*
         * =================================================
         * 3. VALIDATE NEW SHIFT
         * =================================================
         */

        const newShift = await tx.shift.findFirst({
          where: {
            id: dto.shiftId,
            isActive: true,
          },

          select: {
            id: true,
            code: true,
            name: true,
          },
        });

        if (!newShift) {
          throw new NotFoundException('New shift not found');
        }

        /*
         * =================================================
         * 4. PLAN / SHIFT BUSINESS RULES
         * =================================================
         */

        /*
         * HALF
         * -------
         * Morning or Evening only.
         */
        if (
          newPlan.code === 'HALF' &&
          !['MORNING', 'EVENING'].includes(newShift.code)
        ) {
          throw new BadRequestException(
            'Half Time membership only supports Morning or Evening shift',
          );
        }

        /*
         * FULL
         * -------
         * Full Day only.
         */
        if (newPlan.code === 'FULL' && newShift.code !== 'FULL_DAY') {
          throw new BadRequestException(
            'Full Time membership only supports Full Day shift',
          );
        }

        /*
         * FIXED
         * -------
         * Full Day only.
         */
        if (newPlan.code === 'FIXED' && newShift.code !== 'FULL_DAY') {
          throw new BadRequestException(
            'Fixed Seat membership only supports Full Day shift',
          );
        }

        /*
         * =================================================
         * 5. DON'T ALLOW SAME MEMBERSHIP
         * =================================================
         */

        const samePlan =
          currentMembership.membershipPlanId === dto.membershipPlanId;

        const sameShift = currentMembership.shiftId === dto.shiftId;

        const sameSeat =
          currentMembership.fixedSeatId === (dto.fixedSeatId ?? null);

        if (samePlan && sameShift && sameSeat) {
          throw new BadRequestException(
            'New membership configuration is the same as the current membership',
          );
        }

        /*
         * =================================================
         * 6. GET CURRENT PRICING
         * =================================================
         */

        const pricing = await tx.pricing.findFirst({
          where: {
            membershipPlanId: newPlan.id,

            shiftId: newShift.id,

            isActive: true,
          },

          orderBy: {
            effectiveFrom: 'desc',
          },

          select: {
            id: true,
            monthlyFee: true,
            registrationFee: true,
            billingCycleDays: true,
          },
        });

        if (!pricing) {
          throw new BadRequestException(
            'Pricing not configured for selected membership plan and shift',
          );
        }

        /*
         * =================================================
         * 7. VALIDATE NEW FIXED SEAT
         * =================================================
         */

        let newFixedSeatId: string | null = null;

        if (newPlan.requiresFixedSeat) {
          if (!dto.fixedSeatId) {
            throw new BadRequestException(
              'Fixed seat is required for this membership plan',
            );
          }

          /*
           * Don't allow the old fixed seat to be
           * accidentally selected as another allocation.
           */
          const seat = await tx.seat.findUnique({
            where: {
              id: dto.fixedSeatId,
            },

            select: {
              id: true,
              isFixedLocked: true,
            },
          });

          if (!seat) {
            throw new NotFoundException('Selected fixed seat not found');
          }

          /*
           * If it is already locked and it isn't
           * the student's current seat, reject it.
           */
          const isCurrentSeat = currentMembership.fixedSeatId === seat.id;

          if (seat.isFixedLocked && !isCurrentSeat) {
            throw new BadRequestException('Selected seat is not available');
          }

          newFixedSeatId = seat.id;
        }

        /*
         * =================================================
         * 8. CHANGE START DATE
         * =================================================
         */

        const changeStart = new Date(dto.startDate);

        if (Number.isNaN(changeStart.getTime())) {
          throw new BadRequestException('Invalid membership change date');
        }

        /*
         * =================================================
         * 9. CALCULATE NEW END DATE
         * =================================================
         */

        const newEndDate = new Date(changeStart);

        newEndDate.setDate(newEndDate.getDate() + pricing.billingCycleDays);

        /*
         * =================================================
         * 10. CLOSE OLD MEMBERSHIP
         * =================================================
         *
         * Old membership is retained for history.
         *
         * We do not delete it.
         */

        const oldEndDate = new Date(changeStart);

        await tx.membership.update({
          where: {
            id: currentMembership.id,
          },

          data: {
            endDate: oldEndDate,

            isActive: false,
          },
        });

        /*
         * =================================================
         * 11. RELEASE OLD FIXED SEAT
         * =================================================
         *
         * Only release it when the old membership had
         * a fixed seat and the new membership is not
         * using that same fixed seat.
         */

        if (
          currentMembership.fixedSeatId &&
          currentMembership.fixedSeatId !== newFixedSeatId
        ) {
          await tx.seat.update({
            where: {
              id: currentMembership.fixedSeatId,
            },

            data: {
              isFixedLocked: false,
            },
          });
        }

        /*
         * =================================================
         * 12. LOCK NEW FIXED SEAT
         * =================================================
         */

        if (
          newFixedSeatId &&
          newFixedSeatId !== currentMembership.fixedSeatId
        ) {
          await tx.seat.update({
            where: {
              id: newFixedSeatId,
            },

            data: {
              isFixedLocked: true,
            },
          });
        }

        /*
         * =================================================
         * 13. CREATE NEW MEMBERSHIP
         * =================================================
         *
         * Registration fee is ZERO because this is
         * a membership change, not a new registration.
         */

        const newMembership = await tx.membership.create({
          data: {
            studentId: currentMembership.studentId,

            membershipPlanId: newPlan.id,

            shiftId: newShift.id,

            fixedSeatId: newFixedSeatId,

            startDate: changeStart,

            endDate: newEndDate,

            priceSnapshot: pricing.monthlyFee,

            registrationFee: 0,

            isActive: true,
          },

          include: {
            membershipPlan: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            shift: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            fixedSeat: {
              select: {
                id: true,
                seatNumber: true,
                labId: true,
              },
            },
          },
        });

        /*
         * =================================================
         * 14. CREATE NEW MEMBERSHIP CHARGE
         * =================================================
         */

        const charge = await tx.membershipCharge.create({
          data: {
            membershipId: newMembership.id,

            type: 'MEMBERSHIP',

            amountDue: pricing.monthlyFee,

            periodStart: changeStart,

            periodEnd: newEndDate,

            dueDate: changeStart,

            status: 'PENDING',
          },
        });

        /*
         * =================================================
         * 15. VALIDATE INITIAL PAYMENT
         * =================================================
         */

        if (paymentAmount > pricing.monthlyFee) {
          throw new BadRequestException(
            `Payment cannot exceed membership amount of ₹${pricing.monthlyFee}`,
          );
        }

        /*
         * =================================================
         * 16. CREATE INITIAL PAYMENT
         * =================================================
         */

        let payment: {
          id: string;
          amount: number;
          paymentMode: string;
          paymentType: string;
          paidOn: Date;
        } | null = null;

        if (paymentAmount > 0) {
          const createdPayment = await tx.payment.create({
            data: {
              membershipId: newMembership.id,

              studentId: newMembership.studentId,

              amount: paymentAmount,

              paymentMode,

              paymentType: 'MEMBERSHIP_PAYMENT',
            },

            select: {
              id: true,
              amount: true,
              paymentMode: true,
              paymentType: true,
              paidOn: true,
            },
          });

          payment = createdPayment;

          /*
           * Allocate payment directly to
           * the new membership charge.
           */
          await tx.paymentAllocation.create({
            data: {
              paymentId: createdPayment.id,

              chargeId: charge.id,

              amount: paymentAmount,
            },
          });

          /*
           * Update charge status.
           */
          await tx.membershipCharge.update({
            where: {
              id: charge.id,
            },

            data: {
              status: paymentAmount >= pricing.monthlyFee ? 'PAID' : 'PARTIAL',
            },
          });
        }

        /*
         * =================================================
         * 17. PAYMENT SUMMARY
         * =================================================
         */

        const outstanding = Math.max(pricing.monthlyFee - paymentAmount, 0);

        const paymentStatus =
          paymentAmount === 0
            ? 'YET_TO_PAY'
            : outstanding === 0
              ? 'PAID'
              : 'PARTIAL';

        return {
          oldMembership: currentMembership,

          membership: newMembership,

          charge,

          payment,

          paymentSummary: {
            amountDue: pricing.monthlyFee,

            amountPaid: paymentAmount,

            outstanding,

            status: paymentStatus,
          },
        };
      });

      /*
       * =======================================================
       * 18. AUDIT LOG
       * =======================================================
       */

      await this.auditService.log({
        action: 'MEMBERSHIP_CHANGED',

        entity: 'Membership',

        entityId: result.membership.id,

        actorId: '',

        actorName: 'Admin',

        actorRole: 'ADMIN',

        description: 'Membership changed successfully.',

        meta: {
          oldMembershipId: result.oldMembership.id,

          newMembershipId: result.membership.id,

          oldPlanId: result.oldMembership.membershipPlanId,

          newPlanId: result.membership.membershipPlanId,

          oldShiftId: result.oldMembership.shiftId,

          newShiftId: result.membership.shiftId,

          paymentId: result.payment?.id ?? null,

          paymentSummary: result.paymentSummary,
        },
      });

      /*
       * =======================================================
       * 19. RESPONSE
       * =======================================================
       */

      return {
        message: 'Membership changed successfully',

        oldMembership: {
          id: result.oldMembership.id,

          planId: result.oldMembership.membershipPlanId,

          shiftId: result.oldMembership.shiftId,

          fixedSeatId: result.oldMembership.fixedSeatId,

          startDate: result.oldMembership.startDate,

          endDate: result.oldMembership.endDate,
        },

        membership: result.membership,

        charge: result.charge,

        payment: result.payment,

        paymentSummary: result.paymentSummary,
      };
    } catch (error) {
      console.error('CHANGE MEMBERSHIP ERROR:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to change membership');
    }
  }

  async getMembershipAccount(membershipId: string) {
    try {
      const membership = await this.prisma.membership.findUnique({
        where: {
          id: membershipId,
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          priceSnapshot: true,
          registrationFee: true,
          isActive: true,
          student: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
          membershipPlan: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          shift: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          fixedSeat: {
            select: {
              id: true,
              seatNumber: true,
              lab: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          charges: {
            where: {
              status: {
                not: 'CANCELLED',
              },
            },
            orderBy: [
              {
                dueDate: 'asc',
              },
              {
                createdAt: 'asc',
              },
            ],
            select: {
              id: true,
              type: true,
              amountDue: true,
              periodStart: true,
              periodEnd: true,
              dueDate: true,
              status: true,
              allocations: {
                select: {
                  id: true,
                  amount: true,
                  payment: {
                    select: {
                      id: true,
                      amount: true,
                      paymentMode: true,
                      paymentType: true,
                      paidOn: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      const charges = membership.charges.map((charge) => {
        const amountPaid = charge.allocations.reduce(
          (sum, allocation) => sum + allocation.amount,
          0,
        );

        const outstanding = Math.max(charge.amountDue - amountPaid, 0);

        let status: 'YET_TO_PAY' | 'PARTIAL' | 'PAID';

        if (amountPaid === 0) {
          status = 'YET_TO_PAY';
        } else if (outstanding === 0) {
          status = 'PAID';
        } else {
          status = 'PARTIAL';
        }

        return {
          id: charge.id,
          type: charge.type,
          amountDue: charge.amountDue,
          amountPaid,
          outstanding,
          periodStart: charge.periodStart,
          periodEnd: charge.periodEnd,
          dueDate: charge.dueDate,
          status,
          allocations: charge.allocations.map((allocation) => ({
            id: allocation.id,
            amount: allocation.amount,
            payment: allocation.payment,
          })),
        };
      });

      const totalDue = charges.reduce(
        (sum, charge) => sum + charge.amountDue,
        0,
      );

      const totalPaid = charges.reduce(
        (sum, charge) => sum + charge.amountPaid,
        0,
      );

      const outstanding = Math.max(totalDue - totalPaid, 0);

      let status: 'YET_TO_PAY' | 'PARTIAL' | 'PAID';

      if (totalPaid === 0) {
        status = 'YET_TO_PAY';
      } else if (outstanding === 0) {
        status = 'PAID';
      } else {
        status = 'PARTIAL';
      }

      const now = new Date();

      const currentCharges = charges.filter(
        (charge) =>
          charge.type === 'MEMBERSHIP' &&
          charge.periodStart !== null &&
          charge.periodEnd !== null &&
          charge.periodStart <= now &&
          charge.periodEnd > now,
      );

      const futureCharges = charges.filter(
        (charge) =>
          charge.type === 'MEMBERSHIP' &&
          charge.periodStart !== null &&
          charge.periodStart > now,
      );

      const historicalCharges = charges.filter(
        (charge) =>
          !currentCharges.some((current) => current.id === charge.id) &&
          !futureCharges.some((future) => future.id === charge.id),
      );

      const current = currentCharges[0] ?? null;

      const nextRenewal =
        futureCharges.find((charge) => charge.outstanding > 0) ??
        futureCharges[0] ??
        null;

      const paymentMap = new Map<
        string,
        {
          id: string;
          amount: number;
          paymentMode: string;
          paymentType: string;
          paidOn: Date;
          allocatedAmount: number;
        }
      >();

      for (const charge of charges) {
        for (const allocation of charge.allocations) {
          const payment = allocation.payment;
          const existing = paymentMap.get(payment.id);

          if (existing) {
            existing.allocatedAmount += allocation.amount;
          } else {
            paymentMap.set(payment.id, {
              id: payment.id,
              amount: payment.amount,
              paymentMode: payment.paymentMode,
              paymentType: payment.paymentType,
              paidOn: payment.paidOn,
              allocatedAmount: allocation.amount,
            });
          }
        }
      }

      const payments = Array.from(paymentMap.values()).sort(
        (a, b) => b.paidOn.getTime() - a.paidOn.getTime(),
      );

      return {
        membership: {
          id: membership.id,
          isActive: membership.isActive,
          startDate: membership.startDate,
          endDate: membership.endDate,
          priceSnapshot: membership.priceSnapshot,
          registrationFee: membership.registrationFee,
          student: membership.student,
          plan: membership.membershipPlan,
          shift: membership.shift,
          fixedSeat: membership.fixedSeat,
        },

        account: {
          totalDue,
          totalPaid,
          outstanding,
          status,
        },

        current,

        future: futureCharges,

        nextRenewal,

        historical: historicalCharges,

        charges,

        payments,
      };
    } catch (error) {
      console.error('GET MEMBERSHIP ACCOUNT ERROR:', error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to fetch membership account',
      );
    }
  }
}
