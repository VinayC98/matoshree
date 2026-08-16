import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    try {
      /* =========================================================
       1. DATE NORMALIZATION
      ========================================================= */

      const now = new Date();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const monthStart = new Date(
        todayStart.getFullYear(),
        todayStart.getMonth(),
        1,
      );

      /* Monday of current week */
      const weekStart = new Date(todayStart);

      const day = weekStart.getDay();
      const diff = day === 0 ? 6 : day - 1;

      weekStart.setDate(weekStart.getDate() - diff);

      weekStart.setHours(0, 0, 0, 0);

      /* Current year */
      const yearStart = new Date(todayStart.getFullYear(), 0, 1);

      /* Next 7 days */
      const expiryWindowEnd = new Date(todayStart);

      expiryWindowEnd.setDate(expiryWindowEnd.getDate() + 7);

      expiryWindowEnd.setHours(23, 59, 59, 999);

      /* =========================================================
       2. BASIC DASHBOARD DATA
      ========================================================= */

      const [
        totalStudents,
        totalSeats,
        fixedSeatsCount,
        shifts,
        activeMembershipRows,
      ] = await Promise.all([
        this.prisma.student.count(),

        this.prisma.seat.count(),

        this.prisma.seat.count({
          where: {
            isFixedLocked: true,
          },
        }),

        this.prisma.shift.findMany({
          where: {
            isActive: true,
          },

          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            name: 'asc',
          },
        }),

        /*
         * Load active memberships once.
         *
         * We need membership plan + shift information to correctly
         * determine whether the student requires daily allocation.
         */
        this.prisma.membership.findMany({
          where: {
            isActive: true,

            endDate: {
              gte: todayStart,
            },
          },

          select: {
            id: true,
            studentId: true,
            shiftId: true,
            fixedSeatId: true,
            endDate: true,

            membershipPlan: {
              select: {
                code: true,
                name: true,
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
          },
        }),
      ]);

      const activeMemberships = activeMembershipRows.length;

      /* =========================================================
       3. TODAY'S DAILY ALLOCATIONS
       
       IMPORTANT:
       
       We intentionally load ALL active-shift allocations
       for today.
       
       This lets us correctly handle:
       
       FULL_DAY
       MORNING
       EVENING
       
       without incorrectly treating every allocation as
       blocking every shift.
      ========================================================= */

      const todaysAllocations = await this.prisma.dailySeatAllocation.findMany({
        where: {
          date: todayStart,

          shiftId: {
            in: shifts.map((shift) => shift.id),
          },
        },

        select: {
          id: true,
          seatId: true,
          studentId: true,
          shiftId: true,

          shift: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      /* =========================================================
       4. SHIFT CODE HELPERS
      ========================================================= */

      const FULL_DAY = 'FULL_DAY';
      const MORNING = 'MORNING';
      const EVENING = 'EVENING';

      /*
       * Active daily shifts.
       *
       * We only treat these as independently assignable shifts.
       */
      const dailyShifts = shifts.filter(
        (shift) =>
          shift.code === MORNING ||
          shift.code === EVENING ||
          shift.code === FULL_DAY,
      );

      /* =========================================================
       5. SEAT UTILIZATION BY SHIFT
       
       Correct cross-shift behavior:
       
       For MORNING:
         - MORNING allocation blocks seat
         - FULL_DAY allocation blocks seat
         - EVENING does NOT block seat
       
       For EVENING:
         - EVENING allocation blocks seat
         - FULL_DAY allocation blocks seat
         - MORNING does NOT block seat
       
       For FULL_DAY:
         - FULL_DAY allocation blocks seat
      ========================================================= */

      const seatUtilizationByShift = dailyShifts.map((shift) => {
        const occupiedSeatIds = new Set<string>();

        for (const allocation of todaysAllocations) {
          const allocationCode = allocation.shift?.code;

          if (allocation.shiftId === shift.id || allocationCode === FULL_DAY) {
            occupiedSeatIds.add(allocation.seatId);
          }
        }

        const occupiedSeats = occupiedSeatIds.size;

        const availableSeats = Math.max(
          totalSeats - fixedSeatsCount - occupiedSeats,
          0,
        );

        return {
          shiftId: shift.id,
          shiftCode: shift.code,
          shiftName: shift.name,

          occupiedSeats,
          availableSeats,

          totalAssignableSeats: Math.max(totalSeats - fixedSeatsCount, 0),
        };
      });

      /* =========================================================
       6. TRUE "AVAILABLE TODAY"
       
       A physical seat is considered available today when
       there is at least one active shift in which it can
       still be assigned.
       
       Examples:
       
       Seat 1:
         Morning occupied
         Evening free
         => AVAILABLE TODAY
       
       Seat 2:
         Morning occupied
         Evening occupied
         => NOT AVAILABLE TODAY
       
       Seat 3:
         FULL_DAY occupied
         => NOT AVAILABLE TODAY
       
       Seat 4:
         Fixed
         => NOT AVAILABLE TODAY
      ========================================================= */

      /*
       * We need the actual seat IDs to calculate the union
       * correctly.
       */

      const seats = await this.prisma.seat.findMany({
        select: {
          id: true,
          isFixedLocked: true,
        },
      });

      const assignableSeats = seats.filter((seat) => !seat.isFixedLocked);

      /*
       * Determine whether a seat is blocked for every
       * active daily shift.
       */

      let availableSeatsToday = 0;

      for (const seat of assignableSeats) {
        let availableInAtLeastOneShift = false;

        for (const shift of dailyShifts) {
          const blocked = todaysAllocations.some((allocation) => {
            if (allocation.seatId !== seat.id) {
              return false;
            }

            /*
             * FULL_DAY blocks every daily shift.
             */
            if (allocation.shift?.code === FULL_DAY) {
              return true;
            }

            /*
             * Same shift blocks same shift.
             */
            return allocation.shiftId === shift.id;
          });

          if (!blocked) {
            availableInAtLeastOneShift = true;
            break;
          }
        }

        /*
         * If there are no daily shifts, don't claim seats
         * are available for daily allocation.
         */
        if (dailyShifts.length > 0 && availableInAtLeastOneShift) {
          availableSeatsToday++;
        }
      }

      /* =========================================================
       7. OCCUPIED SEATS TODAY
       
       IMPORTANT:
       
       This is unique physical seats occupied at least once,
       NOT raw allocation row count.
       
       Therefore:
       
       Morning + Evening on same seat = 1 occupied seat.
      ========================================================= */

      const occupiedSeatIdsToday = new Set(
        todaysAllocations.map((allocation) => allocation.seatId),
      );

      const occupiedSeatsToday = occupiedSeatIdsToday.size;

      /* =========================================================
       8. REVENUE
      ========================================================= */

      const [
        todayRevenueAgg,
        weeklyRevenueAgg,
        monthlyRevenueAgg,
        yearlyRevenueAgg,
      ] = await Promise.all([
        /* Today */

        this.prisma.payment.aggregate({
          _sum: {
            amount: true,
          },

          where: {
            paidOn: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
        }),

        /* Week */

        this.prisma.payment.aggregate({
          _sum: {
            amount: true,
          },

          where: {
            paidOn: {
              gte: weekStart,
            },
          },
        }),

        /* Month */

        this.prisma.payment.aggregate({
          _sum: {
            amount: true,
          },

          where: {
            paidOn: {
              gte: monthStart,
            },
          },
        }),

        /* Year */

        this.prisma.payment.aggregate({
          _sum: {
            amount: true,
          },

          where: {
            paidOn: {
              gte: yearStart,
            },
          },
        }),
      ]);

      /* =========================================================
       9. REVENUE TREND
      ========================================================= */

      const revenueTrend = await this.prisma.$queryRaw<
        { date: Date; total: number }[]
      >`
        SELECT
          DATE("paidOn") AS date,
          SUM(amount) AS total
        FROM "Payment"
        WHERE "paidOn" >= ${monthStart}
        GROUP BY DATE("paidOn")
        ORDER BY DATE("paidOn") ASC
      `;

      /* =========================================================
       10. MEMBERSHIP IDS
      ========================================================= */

      const activeMembershipIds = activeMembershipRows.map(
        (membership) => membership.id,
      );

      /* =========================================================
       11. PAYMENT ATTENTION
       
       We use MembershipCharge rather than raw Payment rows.
       
       Your membership system already treats:
       
       PENDING
       PARTIAL
       
       as outstanding billing states.
      ========================================================= */

      const outstandingCharges =
        activeMembershipIds.length > 0
          ? await this.prisma.membershipCharge.findMany({
              where: {
                membershipId: {
                  in: activeMembershipIds,
                },

                status: {
                  in: ['PENDING', 'PARTIAL'],
                },
              },

              select: {
                membershipId: true,
                status: true,
              },
            })
          : [];

      const pendingPaymentMembershipIds = new Set<string>();

      const partialPaymentMembershipIds = new Set<string>();

      for (const charge of outstandingCharges) {
        if (charge.status === 'PENDING') {
          pendingPaymentMembershipIds.add(charge.membershipId);
        }

        if (charge.status === 'PARTIAL') {
          partialPaymentMembershipIds.add(charge.membershipId);
        }
      }

      const pendingPayments = pendingPaymentMembershipIds.size;

      const partialPayments = partialPaymentMembershipIds.size;

      /* =========================================================
       12. MEMBERSHIPS EXPIRING SOON
       
       Today through next 7 days.
      ========================================================= */

      const membershipsExpiringSoon = activeMembershipRows.filter(
        (membership) => {
          const endDate = new Date(membership.endDate);

          return endDate >= todayStart && endDate <= expiryWindowEnd;
        },
      ).length;

      /* =========================================================
       13. STUDENTS WITHOUT DAILY SEAT
       
       Only students whose membership actually uses
       daily seat allocation should appear here.
       
       Fixed-seat students are excluded.
      ========================================================= */

      const dailyAllocationMemberships = activeMembershipRows.filter(
        (membership) =>
          membership.fixedSeatId === null &&
          membership.membershipPlan?.isSeatDailyAssigned === true,
      );

      const dailyAllocationStudentIds = new Set(
        dailyAllocationMemberships.map((membership) => membership.studentId),
      );

      /*
       * A student with ANY valid allocation today is
       * considered seated for today's dashboard.
       *
       * This is especially important for Morning/Evening:
       *
       * Morning allocation means the student has a seat
       * for Morning.
       *
       * We don't falsely say they have no seat merely
       * because Evening is different.
       */

      const studentsWithSeatToday = new Set(
        todaysAllocations
          .filter((allocation) =>
            dailyAllocationStudentIds.has(allocation.studentId),
          )
          .map((allocation) => allocation.studentId),
      );

      const studentsWithoutSeatSet = new Set<string>();

      for (const membership of dailyAllocationMemberships) {
        if (!studentsWithSeatToday.has(membership.studentId)) {
          studentsWithoutSeatSet.add(membership.studentId);
        }
      }

      const studentsWithoutSeat = studentsWithoutSeatSet.size;

      /* =========================================================
       14. ATTENTION TOTAL
      ========================================================= */

      const attentionTotal =
        pendingPayments +
        partialPayments +
        membershipsExpiringSoon +
        studentsWithoutSeat;

      /* =========================================================
       15. RESPONSE
      ========================================================= */

      return {
        summary: {
          totalStudents,

          activeMemberships,

          totalSeats,

          fixedSeats: fixedSeatsCount,

          /*
           * Unique physical seats occupied today.
           */
          occupiedSeatsToday,

          /*
           * Physical seats that are still usable in at
           * least one active daily shift.
           */
          availableSeatsToday,
        },

        seatUtilization: {
          byShift: seatUtilizationByShift,
        },

        revenue: {
          today: todayRevenueAgg?._sum?.amount ?? 0,

          week: weeklyRevenueAgg?._sum?.amount ?? 0,

          month: monthlyRevenueAgg?._sum?.amount ?? 0,

          year: yearlyRevenueAgg?._sum?.amount ?? 0,

          trend: revenueTrend.map((row) => ({
            date: row.date,
            amount: Number(row.total),
          })),
        },

        attention: {
          /*
           * Total number of admin attention items.
           */
          total: attentionTotal,

          /*
           * Memberships with unpaid charges.
           */
          pendingPayments,

          /*
           * Memberships with partially paid charges.
           */
          partialPayments,

          /*
           * Memberships ending within 7 days.
           */
          membershipsExpiringSoon,

          /*
           * Daily-seat students who currently have
           * no allocation today.
           */
          studentsWithoutSeat,
        },
      };
    } catch (error: unknown) {
      console.error('DASHBOARD ERROR:', error);

      const message = error instanceof Error ? error.message : 'Unknown error';

      throw new Error(`Failed to load dashboard data: ${message}`);
    }
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
