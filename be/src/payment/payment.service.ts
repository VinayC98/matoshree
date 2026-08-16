import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

import { CreatePaymentDto, PaymentType } from './dto/create-payment.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getPayments({
    page,
    limit,
    paymentType,
  }: {
    page: number;
    limit: number;
    paymentType?: string;
  }) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

    const skip = (safePage - 1) * safeLimit;

    const where = paymentType
      ? {
          paymentType,
        }
      : undefined;

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        skip,
        take: safeLimit,
        where,
        orderBy: {
          paidOn: 'desc',
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },

          membership: {
            select: {
              id: true,
              startDate: true,
              endDate: true,

              membershipPlan: {
                select: {
                  name: true,
                },
              },

              shift: {
                select: {
                  name: true,
                },
              },

              fixedSeat: {
                select: {
                  seatNumber: true,
                  lab: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },

          allocations: {
            select: {
              id: true,
              amount: true,
              charge: {
                select: {
                  id: true,
                  type: true,
                  amountDue: true,
                  periodStart: true,
                  periodEnd: true,
                  status: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.payment.count({
        where,
      }),
    ]);

    return {
      data: payments,

      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Creates a payment and allocates the complete amount
   * against existing membership charges.
   *
   * Important:
   *
   * Payment itself is only the money received.
   *
   * PaymentAllocation decides which charge that money
   * actually pays.
   */
  async createPayment(dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: {
          id: dto.membershipId,
        },

        select: {
          id: true,
          studentId: true,
          isActive: true,
          registrationFee: true,
          priceSnapshot: true,

          charges: {
            where: {
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

            select: {
              id: true,
              type: true,
              amountDue: true,
              status: true,
              dueDate: true,
              periodStart: true,
              periodEnd: true,

              allocations: {
                select: {
                  amount: true,
                },
              },
            },
          },
        },
      });

      if (!membership) {
        throw new BadRequestException('Membership not found');
      }

      if (!membership.isActive) {
        throw new BadRequestException('Invalid or inactive membership');
      }

      if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
        throw new BadRequestException(
          'Payment amount must be greater than zero',
        );
      }

      /*
       * REGISTRATION PAYMENT
       *
       * Registration is allocated only to the
       * registration charge.
       */
      if (dto.paymentType === PaymentType.REGISTRATION) {
        const registrationCharge = membership.charges.find(
          (charge) => charge.type === 'REGISTRATION',
        );

        if (!registrationCharge) {
          throw new BadRequestException('Registration charge not found');
        }

        const registrationPaid = registrationCharge.allocations.reduce(
          (sum, allocation) => sum + allocation.amount,
          0,
        );

        const registrationOutstanding = Math.max(
          registrationCharge.amountDue - registrationPaid,
          0,
        );

        if (registrationOutstanding <= 0) {
          throw new BadRequestException(
            'Registration charge is already fully paid',
          );
        }

        if (dto.amount > registrationOutstanding) {
          throw new BadRequestException(
            `Registration outstanding amount is ₹${registrationOutstanding}`,
          );
        }

        const payment = await tx.payment.create({
          data: {
            membershipId: membership.id,
            studentId: membership.studentId,
            amount: dto.amount,
            paymentMode: dto.paymentMode,
            paymentType: 'REGISTRATION',
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            chargeId: registrationCharge.id,
            amount: dto.amount,
          },
        });

        await this.updateChargeStatus(
          tx,
          registrationCharge.id,
          registrationCharge.amountDue,
          registrationPaid + dto.amount,
        );

        await this.auditService.log({
          action: 'CREATE_PAYMENT',
          entity: 'Payment',
          entityId: payment.id,
          actorId: '',
          actorName: 'Admin',
          actorRole: 'ADMIN',
          description: 'Registration payment recorded',
          meta: {
            paymentId: payment.id,
            membershipId: membership.id,
            amount: dto.amount,
            paymentType: 'REGISTRATION',
            allocatedAmount: dto.amount,
          },
        });

        return {
          payment,
          allocations: [
            {
              chargeId: registrationCharge.id,
              amount: dto.amount,
            },
          ],
        };
      }

      /*
       * MEMBERSHIP PAYMENT
       *
       * MONTHLY / PARTIAL / ADVANCE all use the
       * same accounting mechanism.
       *
       * The payment is allocated chronologically
       * across outstanding membership charges.
       */
      const membershipCharges = membership.charges.filter(
        (charge) => charge.type === 'MEMBERSHIP',
      );

      if (membershipCharges.length === 0) {
        throw new BadRequestException(
          'No outstanding membership charges found',
        );
      }

      const chargesWithOutstanding = membershipCharges
        .map((charge) => {
          const paid = charge.allocations.reduce(
            (sum, allocation) => sum + allocation.amount,
            0,
          );

          const outstanding = Math.max(charge.amountDue - paid, 0);

          return {
            ...charge,
            amountPaid: paid,
            outstanding,
          };
        })
        .filter((charge) => charge.outstanding > 0);

      if (chargesWithOutstanding.length === 0) {
        throw new BadRequestException(
          'All membership charges are already fully paid',
        );
      }

      const totalOutstanding = chargesWithOutstanding.reduce(
        (sum, charge) => sum + charge.outstanding,
        0,
      );

      /*
       * Never allow money to disappear.
       *
       * If the user wants to pay more than all
       * currently outstanding charges, reject it.
       */
      if (dto.amount > totalOutstanding) {
        throw new BadRequestException(
          `Maximum outstanding amount is ₹${totalOutstanding}`,
        );
      }

      /*
       * Create the payment first.
       *
       * Existing database convention is kept:
       *
       * REGISTRATION
       * MEMBERSHIP_PAYMENT
       */
      const payment = await tx.payment.create({
        data: {
          membershipId: membership.id,
          studentId: membership.studentId,
          amount: dto.amount,
          paymentMode: dto.paymentMode,
          paymentType: 'MEMBERSHIP_PAYMENT',
        },
      });

      let remainingAmount = dto.amount;

      const allocations: Array<{
        chargeId: string;
        amount: number;
      }> = [];

      /*
       * Allocate oldest outstanding charge first.
       *
       * Example:
       *
       * Charge 1 outstanding = ₹200
       * Charge 2 outstanding = ₹350
       *
       * Payment = ₹400
       *
       * Allocation:
       * Charge 1 = ₹200
       * Charge 2 = ₹200
       */
      for (const charge of chargesWithOutstanding) {
        if (remainingAmount <= 0) {
          break;
        }

        const allocationAmount = Math.min(remainingAmount, charge.outstanding);

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            chargeId: charge.id,
            amount: allocationAmount,
          },
        });

        const newPaidAmount = charge.amountPaid + allocationAmount;

        await this.updateChargeStatus(
          tx,
          charge.id,
          charge.amountDue,
          newPaidAmount,
        );

        allocations.push({
          chargeId: charge.id,
          amount: allocationAmount,
        });

        remainingAmount -= allocationAmount;
      }

      /*
       * This should never happen because we validate
       * totalOutstanding above.
       *
       * Keep this guard so the transaction cannot
       * accidentally create an under-allocated payment.
       */
      if (remainingAmount !== 0) {
        throw new BadRequestException(
          'Payment could not be completely allocated',
        );
      }

      await this.auditService.log({
        action: 'CREATE_PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',
        description: 'Membership payment recorded',
        meta: {
          paymentId: payment.id,
          membershipId: membership.id,
          amount: dto.amount,
          paymentType: 'MEMBERSHIP_PAYMENT',
          allocations,
        },
      });

      /*
       * Do NOT extend membership.endDate here.
       *
       * Membership duration is managed by the
       * membership / renewal flow.
       *
       * Payment recording should only record
       * money and allocate it to charges.
       */
      if (dto.extendMembership === true) {
        throw new BadRequestException(
          'Membership extension must be handled through membership renewal',
        );
      }

      return {
        payment,
        allocations,
      };
    });
  }

  /**
   * Updates MembershipCharge status after allocation.
   */
  private async updateChargeStatus(
    tx: Prisma.TransactionClient,
    chargeId: string,
    amountDue: number,
    amountPaid: number,
  ) {
    let status: 'PENDING' | 'PARTIAL' | 'PAID';

    if (amountPaid <= 0) {
      status = 'PENDING';
    } else if (amountPaid < amountDue) {
      status = 'PARTIAL';
    } else {
      status = 'PAID';
    }

    await tx.membershipCharge.update({
      where: {
        id: chargeId,
      },
      data: {
        status,
      },
    });
  }
}
