import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';

import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MembershipExpiryService implements OnModuleInit {
  private readonly logger = new Logger(MembershipExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}
  /**
   * Runs every minute.
   *
   * Responsibilities:
   * - Expire memberships whose endDate has passed
   * - Unlock fixed seats when they are no longer used
   * - Remove future daily seat allocations
   * - Create audit records for the expiration
   */
  onModuleInit(): void {
    const schedule = this.configService.get<string>(
      'MEMBERSHIP_EXPIRY_CRON',
      '*/1 * * * *',
    );

    const job = new CronJob(schedule, () => {
      void this.handleMembershipExpiry();
    });

    this.schedulerRegistry.addCronJob('membership-expiry', job);

    job.start();

    this.logger.log(`Membership expiry cron registered: ${schedule}`);
  }

  async handleMembershipExpiry(): Promise<void> {
    const now = new Date();

    try {
      /*
       * Find memberships that have expired.
       *
       * Include studentId so we don't need a second query later.
       */
      const expiredMemberships = await this.prisma.membership.findMany({
        where: {
          isActive: true,
          endDate: {
            lt: now,
          },
        },
        select: {
          id: true,
          studentId: true,
          fixedSeatId: true,
          endDate: true,
          membershipPlan: {
            select: {
              code: true,
              name: true,
            },
          },
          shift: {
            select: {
              code: true,
              name: true,
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
        },
      });

      if (expiredMemberships.length === 0) {
        return;
      }

      const membershipIds = expiredMemberships.map(
        (membership) => membership.id,
      );

      const studentIds = [
        ...new Set(
          expiredMemberships.map((membership) => membership.studentId),
        ),
      ];

      const fixedSeatIds = [
        ...new Set(
          expiredMemberships
            .map((membership) => membership.fixedSeatId)
            .filter((seatId): seatId is string => Boolean(seatId)),
        ),
      ];

      /*
       * Everything that changes the allocation state happens
       * inside one transaction.
       */
      const result = await this.prisma.$transaction(async (tx) => {
        /*
         * 1. Mark memberships inactive.
         */
        const expiredResult = await tx.membership.updateMany({
          where: {
            id: {
              in: membershipIds,
            },
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        /*
         * 2. Unlock fixed seats only when there is no other
         * active membership using that seat.
         *
         * This prevents accidentally unlocking a seat that
         * belongs to another active membership.
         */
        let unlockedSeatCount = 0;

        if (fixedSeatIds.length > 0) {
          const seatsStillInUse = await tx.membership.findMany({
            where: {
              fixedSeatId: {
                in: fixedSeatIds,
              },
              isActive: true,
            },
            select: {
              fixedSeatId: true,
            },
          });

          const stillUsedSeatIds = new Set(
            seatsStillInUse
              .map((membership) => membership.fixedSeatId)
              .filter((seatId): seatId is string => Boolean(seatId)),
          );

          const seatsToUnlock = fixedSeatIds.filter(
            (seatId) => !stillUsedSeatIds.has(seatId),
          );

          if (seatsToUnlock.length > 0) {
            const unlocked = await tx.seat.updateMany({
              where: {
                id: {
                  in: seatsToUnlock,
                },
                isFixedLocked: true,
              },
              data: {
                isFixedLocked: false,
              },
            });

            unlockedSeatCount = unlocked.count;
          }
        }

        /*
         * 3. Remove future daily allocations belonging
         * to students whose membership has expired.
         *
         * Only future allocations are removed.
         * Today's allocations remain untouched.
         */
        const deletedAllocations = await tx.dailySeatAllocation.deleteMany({
          where: {
            date: {
              gt: now,
            },
            studentId: {
              in: studentIds,
            },
          },
        });

        /*
         * 4. Write an audit record for every expired
         * membership.
         *
         * Keeping this inside the transaction means the
         * expiration and its audit record succeed/fail
         * together.
         */
        await Promise.all(
          expiredMemberships.map((membership) =>
            tx.auditLog.create({
              data: {
                action: 'MEMBERSHIP_EXPIRED',
                entity: 'Membership',
                entityId: membership.id,
                meta: {
                  reason: 'AUTOMATIC_EXPIRY',
                  studentId: membership.studentId,
                  studentName: membership.student.name,
                  studentMobile: membership.student.mobile,
                  membershipPlan: membership.membershipPlan.code,
                  membershipPlanName: membership.membershipPlan.name,
                  shiftCode: membership.shift.code,
                  shiftName: membership.shift.name,
                  fixedSeatId: membership.fixedSeatId,
                  expiredAt: membership.endDate.toISOString(),
                  processedAt: now.toISOString(),
                },
              },
            }),
          ),
        );

        return {
          expiredCount: expiredResult.count,
          unlockedSeatCount,
          deletedAllocationCount: deletedAllocations.count,
        };
      });

      this.logger.log(
        [
          `Membership expiry completed.`,
          `Expired: ${result.expiredCount}`,
          `Unlocked seats: ${result.unlockedSeatCount}`,
          `Removed future allocations: ${result.deletedAllocationCount}`,
        ].join(' '),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Membership expiry job failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
