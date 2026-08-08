import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MembershipExpiryService {
  private readonly logger = new Logger(MembershipExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every 5 minutes
   * - Expires memberships
   * - Unlocks fixed seats
   * - Cleans future allocations
   */
  @Cron('*/1 * * * *')
  async handleMembershipExpiry() {
    console.log('🔥 CRON FIRED AT', new Date().toISOString());
    const now = new Date();

    try {
      /* 1️⃣ Find active memberships that are expired */
      const expiredMemberships = await this.prisma.membership.findMany({
        where: {
          isActive: true,
          endDate: { lt: now },
        },
        select: {
          id: true,
          fixedSeatId: true,
        },
      });

      if (expiredMemberships.length === 0) {
        console.log('No memberships to expire at this time');
        return;
      }

      const membershipIds = expiredMemberships.map((m) => m.id);

      /* 2️⃣ Mark memberships inactive */
      await this.prisma.membership.updateMany({
        where: { id: { in: membershipIds } },
        data: { isActive: false },
      });

      /* 3️⃣ Unlock fixed seats */
      const fixedSeatIds = expiredMemberships
        .filter((m) => m.fixedSeatId)
        .map((m) => m.fixedSeatId as string);

      if (fixedSeatIds.length > 0) {
        await this.prisma.seat.updateMany({
          where: { id: { in: fixedSeatIds } },
          data: { isFixedLocked: false },
        });
      }

      /* 4️⃣ (Safety) Remove future seat allocations */
      await this.prisma.dailySeatAllocation.deleteMany({
        where: {
          date: { gt: now },
          studentId: {
            in: (
              await this.prisma.membership.findMany({
                where: { id: { in: membershipIds } },
                select: { studentId: true },
              })
            ).map((m) => m.studentId),
          },
        },
      });

      this.logger.log(
        `Expired ${expiredMemberships.length} memberships and unlocked seats`,
      );
    } catch (error) {
      this.logger.error('Error while expiring memberships', error.stack);
    }
  }
}
