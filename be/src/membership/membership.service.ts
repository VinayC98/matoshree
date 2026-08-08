import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { CreateMembershipDto } from './dto/create-membership.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new membership using dynamic plans, shifts, and pricing
   * Registration fee payment is auto-recorded here
   */
  async createMembership(dto: CreateMembershipDto) {
    try {
      /* 1️⃣ Validate student */
      const student = await this.prisma.student.findUnique({
        where: { id: dto.studentId },
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const now = new Date();

      // 🚫 BLOCK MULTIPLE ACTIVE MEMBERSHIPS
      const activeMembership = await this.prisma.membership.findFirst({
        where: {
          studentId: dto.studentId,
          isActive: true,
          endDate: { gte: now },
        },
      });

      if (activeMembership) {
        throw new BadRequestException(
          'Student already has an active membership',
        );
      }

      /* 2️⃣ Validate membership plan */
      const plan = await this.prisma.membershipPlan.findFirst({
        where: { id: dto.membershipPlanId, isActive: true },
      });
      if (!plan) {
        throw new NotFoundException('Membership plan not found');
      }

      /* 3️⃣ Validate shift */
      const shift = await this.prisma.shift.findFirst({
        where: { id: dto.shiftId, isActive: true },
      });
      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      /* 4️⃣ Fetch active pricing for plan + shift */
      const pricing = await this.prisma.pricing.findFirst({
        where: {
          membershipPlanId: plan.id,
          shiftId: shift.id,
          isActive: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (!pricing) {
        throw new BadRequestException(
          'Pricing not configured for selected plan and shift',
        );
      }

      /* 5️⃣ Fixed seat validation & locking (only if required) */
      let fixedSeatId: string | null = null;

      if (plan.requiresFixedSeat) {
        if (!dto.fixedSeatId) {
          throw new BadRequestException(
            'Fixed seat is required for this membership plan',
          );
        }

        const seat = await this.prisma.seat.findUnique({
          where: { id: dto.fixedSeatId },
        });

        if (!seat || seat.isFixedLocked) {
          throw new BadRequestException('Selected seat is not available');
        }

        // Lock seat for fixed membership
        await this.prisma.seat.update({
          where: { id: seat.id },
          data: { isFixedLocked: true },
        });

        fixedSeatId = seat.id;
      }

      /* 6️⃣ Calculate membership start & end dates */
      const startDate = new Date(dto.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + pricing.billingCycleDays);

      /* 7️⃣ Create membership */
      const membership = await this.prisma.membership.create({
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

      /* AUDIT LOG (✅ NOW REACHABLE) */
      membership &&
        (await this.auditService.log({
          action: 'MEMBERSHIP_CREATED',
          entity: 'Membership',
          entityId: student.id,
          actorId: '',
          actorName: 'Admin',
          actorRole: 'ADMIN',
          description: `Membership Created Successfully.`,
          meta: {
            MembershipInfo: membership,
          },
        }));

      /* 8️⃣ AUTO-CREATE REGISTRATION FEE PAYMENT (ONE-TIME) */
      // await this.prisma.payment.create({
      //   data: {
      //     membershipId: membership.id,
      //     studentId: membership.studentId,
      //     amount: membership.registrationFee,
      //     paymentMode: 'CASH', // default, can be changed later
      //     paymentType: 'REGISTRATION',
      //   },
      // });

      return {
        message: 'Membership created successfully',
        membership,
      };
    } catch (error) {
      if (error.status) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create membership');
    }
  }
}
