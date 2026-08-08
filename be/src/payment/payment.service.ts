import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
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
    const skip = (page - 1) * limit;

    const where = paymentType ? { paymentType } : undefined;

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        skip,
        take: limit,
        where,
        orderBy: { paidOn: 'desc' },
        include: {
          student: {
            select: { id: true, name: true, mobile: true },
          },
          membership: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              membershipPlan: {
                select: { name: true },
              },
              shift: {
                select: { name: true },
              },
              fixedSeat: {
                select: {
                  seatNumber: true,
                  lab: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isCurrentCyclePaid(
    membershipStart: Date,
    membershipEnd: Date,
    payments: { paidOn: Date; paymentType: string }[],
  ) {
    const cycleStart = membershipStart;
    const cycleEnd = membershipEnd;

    return payments.some(
      (p) =>
        p.paymentType === 'MONTHLY' &&
        p.paidOn >= cycleStart &&
        p.paidOn <= cycleEnd,
    );
  }

  async createPayment(dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { id: dto.membershipId },
        include: { payments: true },
      });
      console.log(membership);

      if (!membership || !membership.isActive) {
        throw new BadRequestException('Invalid or inactive membership');
      }

      const monthlyFee = membership.priceSnapshot;
      const registrationFee = membership.registrationFee;

      // =============================
      // VALIDATE PAYMENT TYPE
      // =============================

      if (dto.paymentType === 'REGISTRATION') {
        if (dto.amount !== registrationFee) {
          throw new BadRequestException('Invalid registration fee amount');
        }
      }

      if (dto.paymentType === 'MONTHLY') {
        if (dto.amount < monthlyFee) {
          throw new BadRequestException('Insufficient monthly payment');
        }

        const alreadyPaid = await this.isCurrentCyclePaid(
          membership.startDate,
          membership.endDate,
          membership.payments,
        );

        if (alreadyPaid && dto.extendMembership !== true) {
          throw new BadRequestException(
            'Monthly fee already paid for this period. Use ADVANCE or extend membership.',
          );
        }
      }

      // =============================
      // CREATE PAYMENT (NO SIDE EFFECT)
      // =============================

      const payment = await tx.payment.create({
        data: {
          membershipId: membership.id,
          studentId: membership.studentId,
          amount: dto.amount,
          paymentMode: dto.paymentMode,
          paymentType: dto.paymentType,
        },
      });

      await this.auditService.log({
        action: 'CREATE_PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',
        description: 'Payment recorded',
        meta: { payment },
      });

      // =============================
      // EXPLICIT EXTENSION ONLY
      // =============================

      if (dto.extendMembership === true) {
        if (!dto.extendMonths || dto.extendMonths < 1) {
          throw new BadRequestException('Invalid extension duration');
        }

        const oldEndDate = membership.endDate;
        const newEndDate = new Date(
          oldEndDate.getTime() + dto.extendMonths * 30 * 24 * 60 * 60 * 1000,
        );

        await tx.membership.update({
          where: { id: membership.id },
          data: { endDate: newEndDate },
        });

        await this.auditService.log({
          action: 'EXTEND_MEMBERSHIP',
          entity: 'Membership',
          entityId: membership.id,
          actorId: '',
          actorName: 'Admin',
          actorRole: 'ADMIN',
          description: `Membership extended by ${dto.extendMonths} month(s)`,
          meta: {
            oldEndDate,
            newEndDate,
            paymentId: payment.id,
          },
        });
      }

      return payment;
    });
  }
  /**
   * Record a payment (registration or monthly)
   */
  // async createPayment(dto: CreatePaymentDto) {
  //   return this.prisma.$transaction(async (tx) => {
  //     const membership = await tx.membership.findUnique({
  //       where: { id: dto.membershipId },
  //     });

  //     if (!membership || !membership.isActive) {
  //       throw new BadRequestException('Invalid or inactive membership');
  //     }

  //     // Backward compatibility
  //     const paymentType = dto.isRegistrationFee === true ? 'REGISTRATION' : dto.paymentType;

  //     const monthlyFee = membership.priceSnapshot;
  //     const registrationFee = membership.registrationFee;
  //     const billingDays = 30; // your system standard

  //     let extendDays = 0;

  //     switch (paymentType) {
  //       case 'REGISTRATION':
  //         if (dto.amount !== registrationFee) {
  //           throw new BadRequestException('Invalid registration fee amount');
  //         }
  //         break;

  //       case 'MONTHLY':
  //         if (dto.amount < monthlyFee) {
  //           throw new BadRequestException('Insufficient monthly payment');
  //         }
  //         extendDays = billingDays;
  //         break;

  //       case 'ADVANCE':
  //         extendDays = Math.floor(dto.amount / monthlyFee) * billingDays;
  //         if (extendDays === 0) {
  //           throw new BadRequestException('Advance amount too low');
  //         }
  //         break;

  //       case 'PARTIAL':
  //         // no extension
  //         break;
  //     }

  //     const payment = await tx.payment.create({
  //       data: {
  //         membershipId: membership.id,
  //         studentId: membership.studentId,
  //         amount: dto.amount,
  //         paymentMode: dto.paymentMode,
  //         paymentType,
  //       },
  //     });

  //     payment &&
  //       /* AUDIT LOG (✅ NOW REACHABLE) */
  //       (await this.auditService.log({
  //         action: 'CREATE_PAYMENT',
  //         entity: 'Payment',
  //         entityId: membership.studentId,
  //         actorId: '',
  //         actorName: 'Admin',
  //         actorRole: 'ADMIN',
  //         description: `Payment Created Successfully.`,
  //         meta: {
  //           PaymentInfo: payment,
  //         },
  //       }));

  //     if (extendDays > 0) {
  //       await tx.membership.update({
  //         where: { id: membership.id },
  //         data: {
  //           endDate: new Date(membership.endDate.getTime() + extendDays * 24 * 60 * 60 * 1000),
  //         },
  //       });
  //     }

  //     return payment;
  //   });
  // }

  // async createPayment(dto: CreatePaymentDto) {
  //   return this.prisma.$transaction(async (tx) => {
  //     const membership = await tx.membership.findUnique({
  //       where: { id: dto.membershipId },
  //     });

  //     if (!membership || !membership.isActive) {
  //       throw new BadRequestException('Invalid or inactive membership');
  //     }

  //     const paymentType = dto.isRegistrationFee === true ? 'REGISTRATION' : dto.paymentType;

  //     // ===== VALIDATIONS ONLY =====

  //     if (paymentType === 'REGISTRATION') {
  //       if (dto.amount !== membership.registrationFee) {
  //         throw new BadRequestException('Invalid registration fee amount');
  //       }
  //     }

  //     if (paymentType === 'MONTHLY') {
  //       if (dto.amount < membership.priceSnapshot) {
  //         throw new BadRequestException('Insufficient monthly payment');
  //       }
  //     }

  //     // ===== CREATE PAYMENT (NO SIDE EFFECTS) =====

  //     const payment = await tx.payment.create({
  //       data: {
  //         membershipId: membership.id,
  //         studentId: membership.studentId,
  //         amount: dto.amount,
  //         paymentMode: dto.paymentMode,
  //         paymentType,
  //       },
  //     });

  //     await this.auditService.log({
  //       action: 'CREATE_PAYMENT',
  //       entity: 'Payment',
  //       entityId: payment.id,
  //       actorId: '',
  //       actorName: 'Admin',
  //       actorRole: 'ADMIN',
  //       description: 'Payment recorded',
  //       meta: { payment },
  //     });

  //     // ===== EXPLICIT EXTENSION ONLY =====

  //     if (dto.extendMembership === true) {
  //       if (!dto.extendMonths || dto.extendMonths < 1) {
  //         throw new BadRequestException('Invalid extension duration');
  //       }

  //       const oldEndDate = membership.endDate;
  //       const newEndDate = new Date(
  //         oldEndDate.getTime() + dto.extendMonths * 30 * 24 * 60 * 60 * 1000,
  //       );

  //       await tx.membership.update({
  //         where: { id: membership.id },
  //         data: { endDate: newEndDate },
  //       });

  //       await this.auditService.log({
  //         action: 'EXTEND_MEMBERSHIP',
  //         entity: 'Membership',
  //         entityId: membership.id,
  //         actorId: '',
  //         actorName: 'Admin',
  //         actorRole: 'ADMIN',
  //         description: `Membership extended by ${dto.extendMonths} month(s)`,
  //         meta: {
  //           oldEndDate,
  //           newEndDate,
  //           paymentId: payment.id,
  //         },
  //       });
  //     }

  //     return payment;
  //   });
  // }
}
