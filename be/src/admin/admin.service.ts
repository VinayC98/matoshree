import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    try {
      /* 1️⃣ Normalize dates */
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(
        todayStart.getFullYear(),
        todayStart.getMonth(),
        1,
      );

      /* 2️⃣ Base counts */
      const [
        totalStudents,
        activeMemberships,
        totalSeats,
        fixedSeatsCount,
        shifts,
      ] = await Promise.all([
        this.prisma.student.count(),
        this.prisma.membership.count({ where: { isActive: true } }),
        this.prisma.seat.count(),
        this.prisma.seat.count({ where: { isFixedLocked: true } }),
        this.prisma.shift.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true },
        }),
      ]);

      /* 3️⃣ Occupied seats today (any shift) */
      const occupiedSeatsToday = await this.prisma.dailySeatAllocation.count({
        where: { date: todayStart },
      });

      /* 4️⃣ True available seats today */
      const availableSeatsToday = Math.max(
        totalSeats - fixedSeatsCount - occupiedSeatsToday,
        0,
      );

      /* 5️⃣ Seat utilization by shift (fixed seats excluded) */
      const seatUtilizationByShift = await Promise.all(
        shifts.map(async (shift) => {
          const occupied = await this.prisma.dailySeatAllocation.count({
            where: {
              date: todayStart,
              shiftId: shift.id,
            },
          });

          return {
            shiftId: shift.id,
            shiftCode: shift.code,
            shiftName: shift.name,
            occupiedSeats: occupied,
            availableSeats: Math.max(
              totalSeats - fixedSeatsCount - occupied,
              0,
            ),
          };
        }),
      );

      /* 6️⃣ Revenue */
      const [todayRevenueAgg, monthlyRevenueAgg] = await Promise.all([
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidOn: { gte: todayStart } },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidOn: { gte: monthStart } },
        }),
      ]);

      /* 7️⃣ Monthly revenue trend */
      const revenueTrend = await this.prisma.$queryRaw<
        { date: Date; total: number }[]
      >`
      SELECT 
        DATE("paidOn") as date,
        SUM(amount) as total
      FROM "Payment"
      WHERE "paidOn" >= ${monthStart}
      GROUP BY DATE("paidOn")
      ORDER BY DATE("paidOn") ASC
    `;

      return {
        summary: {
          totalStudents,
          activeMemberships,
          totalSeats,
          fixedSeats: fixedSeatsCount,
          occupiedSeatsToday,
          availableSeatsToday,
        },

        seatUtilization: {
          byShift: seatUtilizationByShift,
        },

        revenue: {
          today: todayRevenueAgg?._sum?.amount ?? 0,
          month: monthlyRevenueAgg?._sum?.amount ?? 0,
          trend: revenueTrend.map((r) => ({
            date: r.date,
            amount: Number(r.total),
          })),
        },
      };
    } catch (error) {
      throw new Error(`Failed to load dashboard data: ${error.message}`);
    }
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
