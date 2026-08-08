import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { RunAllocationDto } from './dto/run-allocation.dto.js';
import { AssignSeatDto } from './dto/assign-seat.dto.js';
import { SeatAvailabilityDto } from './dto/seat-availability.dto.js';
import { UnassignSeatDto } from './dto/unassign-seat.dto.js';
import { SwapDailySeatDto, SwapFixedSeatDto } from './dto/swap-seat.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service.js';

const TEMP_UUID = randomUUID(); // Used for optimistic UI updates in frontend, no real significance in backend

@Injectable()
export class AllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Run seat allocation for a given date & shift
   * Safe to run multiple times (idempotent)
   */
  async runAllocation(dto: RunAllocationDto) {
    try {
      const allocationDate = new Date(dto.date);

      /* 1️⃣ Validate shift */
      const shift = await this.prisma.shift.findFirst({
        where: { id: dto.shiftId, isActive: true },
      });
      if (!shift) {
        throw new BadRequestException('Invalid shift');
      }

      /* 2️⃣ Get active memberships for this shift */
      const memberships = await this.prisma.membership.findMany({
        where: {
          isActive: true,
          shiftId: shift.id,
          startDate: { lte: allocationDate },
          endDate: { gte: allocationDate },
          fixedSeatId: null, // exclude fixed seat memberships
        },
        orderBy: { startDate: 'asc' },
      });

      if (memberships.length === 0) {
        return { message: 'No memberships to allocate', allocated: 0 };
      }

      /* 3️⃣ Get available seats (exclude fixed locked seats) */
      const availableSeats = await this.prisma.seat.findMany({
        where: { isFixedLocked: false },
        orderBy: { seatNumber: 'asc' },
      });

      if (availableSeats.length < memberships.length) {
        throw new BadRequestException(
          'Not enough seats available for allocation',
        );
      }

      /* 4️⃣ Remove existing allocations for same date & shift (idempotent) */
      await this.prisma.dailySeatAllocation.deleteMany({
        where: {
          date: allocationDate,
          shiftId: shift.id,
        },
      });

      /* 5️⃣ Assign seats sequentially */
      const allocations = memberships.map((membership, index) => ({
        date: allocationDate,
        shiftId: shift.id,
        studentId: membership.studentId,
        seatId: availableSeats[index].id,
        labId: availableSeats[index].labId,
      }));

      /* 6️⃣ Bulk insert allocations */
      await this.prisma.dailySeatAllocation.createMany({
        data: allocations,
      });

      return {
        message: 'Seat allocation completed',
        allocated: allocations.length,
      };
    } catch (error) {
      if (error.status) throw error;
      throw new InternalServerErrorException('Failed to run seat allocation');
    }
  }

  async getAllocations(date: string, shiftId: string) {
    const allocationDate = new Date(date);

    const allocations = await this.prisma.dailySeatAllocation.findMany({
      where: {
        date: allocationDate,
        shiftId,
      },
      include: {
        student: {
          select: { id: true, name: true },
        },
        seat: {
          select: { id: true, seatNumber: true, labId: true },
        },
        lab: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        seat: { seatNumber: 'asc' },
      },
    });

    return allocations.map((a) => ({
      seatId: a.seat.id,
      seatNumber: a.seat.seatNumber,
      labName: a.lab.name,
      student: {
        id: a.student.id,
        name: a.student.name,
      },
    }));
  }

  /**
   * Cinema-style seat map
   * Grouped by lab -> rows -> seats
   */
  // async seatMap(date: string, shiftId: string) {
  //   const allocationDate = new Date(date);
  //   const dayStart = new Date(allocationDate);
  //   dayStart.setHours(0, 0, 0, 0);

  //   const dayEnd = new Date(allocationDate);
  //   dayEnd.setHours(23, 59, 59, 999);

  //   const SEATS_PER_ROW = 6;

  //   const shift = await this.prisma.shift.findUnique({
  //     where: { id: shiftId },
  //   });

  //   if (!shift) {
  //     throw new BadRequestException('Invalid shift');
  //   }

  //   // Determine overlapping shifts
  //   const blockingShiftCodes =
  //     shift.code === 'MORNING'
  //       ? ['MORNING', 'FULL_DAY']
  //       : shift.code === 'EVENING'
  //         ? ['EVENING', 'FULL_DAY']
  //         : ['MORNING', 'EVENING', 'FULL_DAY'];

  //   type SeatStudent = {
  //     id: string;
  //     name: string;
  //   };

  //   const seats = await this.prisma.seat.findMany({
  //     include: {
  //       lab: {
  //         select: { id: true, name: true },
  //       },

  //       allocations: {
  //         where: {
  //           date: allocationDate,
  //           shift: {
  //             code: { in: blockingShiftCodes },
  //           },
  //         },
  //         include: {
  //           student: {
  //             select: { id: true, name: true },
  //           },
  //         },
  //       },

  //       memberships: {
  //         where: {
  //           isActive: true,
  //           fixedSeatId: { not: null },
  //           startDate: { lte: dayEnd },
  //           endDate: { gte: dayStart },
  //         },
  //         select: {
  //           student: {
  //             select: { id: true, name: true },
  //           },
  //         },
  //       },
  //     },
  //     orderBy: [{ labId: 'asc' }, { seatNumber: 'asc' }],
  //   });

  //   const labMap = new Map<string, any>();

  //   for (const seat of seats) {
  //     if (!labMap.has(seat.lab.id)) {
  //       labMap.set(seat.lab.id, {
  //         labId: seat.lab.id,
  //         labName: seat.lab.name,
  //         rows: [],
  //       });
  //     }

  //     const lab = labMap.get(seat.lab.id);
  //     const rowIndex = Math.floor((seat.seatNumber - 1) / SEATS_PER_ROW);

  //     if (!lab.rows[rowIndex]) {
  //       lab.rows[rowIndex] = {
  //         rowNumber: rowIndex + 1,
  //         seats: [],
  //       };
  //     }

  //     const fixedMembership = seat.memberships[0];
  //     const allocation = seat.allocations[0];

  //     let status: 'FREE' | 'OCCUPIED' | 'FIXED' = 'FREE';
  //     let student: SeatStudent | null = null;

  //     if (fixedMembership) {
  //       status = 'FIXED';
  //       student = fixedMembership.student;
  //     } else if (allocation) {
  //       status = 'OCCUPIED';
  //       student = allocation.student;
  //     }

  //     lab.rows[rowIndex].seats.push({
  //       seatId: seat.id,
  //       seatNumber: seat.seatNumber,
  //       status,
  //       student: student ? { id: student.id, name: student.name } : null,
  //     });
  //   }

  //   return Array.from(labMap.values());
  // }
  async seatMap(date: string, shiftId: string) {
    const allocationDate = new Date(date);
    allocationDate.setHours(0, 0, 0, 0);

    const dayStart = new Date(allocationDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(allocationDate);
    dayEnd.setHours(23, 59, 59, 999);

    const SEATS_PER_ROW = 6;

    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new BadRequestException('Invalid shift');
    }

    /* 🔐 Blocking rules */
    const blockingShiftCodes =
      shift.code === 'MORNING'
        ? ['MORNING', 'FULL_DAY']
        : shift.code === 'EVENING'
          ? ['EVENING', 'FULL_DAY']
          : ['MORNING', 'EVENING', 'FULL_DAY'];

    const seats = await this.prisma.seat.findMany({
      include: {
        lab: { select: { id: true, name: true } },

        /* Daily allocations */
        allocations: {
          where: {
            date: dayStart,
            shift: { code: { in: blockingShiftCodes } },
          },
          include: {
            shift: { select: { code: true, name: true } },
            student: { select: { id: true, name: true } },
          },
        },

        /* Fixed seat memberships — FIXED HERE */
        memberships: {
          where: {
            isActive: true,
            fixedSeatId: { not: null },

            /* 👇 KEY FIX */
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
          },
          select: {
            student: { select: { id: true, name: true } },
            endDate: true,
          },
        },
      },
      orderBy: [{ labId: 'asc' }, { seatNumber: 'asc' }],
    });

    const labMap = new Map<string, any>();

    for (const seat of seats) {
      if (!labMap.has(seat.lab.id)) {
        labMap.set(seat.lab.id, {
          labId: seat.lab.id,
          labName: seat.lab.name,
          rows: [],
        });
      }

      const lab = labMap.get(seat.lab.id);
      const rowIndex = Math.floor((seat.seatNumber - 1) / SEATS_PER_ROW);

      if (!lab.rows[rowIndex]) {
        lab.rows[rowIndex] = {
          rowNumber: rowIndex + 1,
          seats: [],
        };
      }

      const fixedMembership = seat.memberships[0];
      const allocation = seat.allocations[0];

      type SeatStudent = {
        id: string;
        name: string;
        validTill?: Date;
      };

      let status: 'FREE' | 'OCCUPIED' | 'FIXED' = 'FREE';
      let student: SeatStudent | null = null;
      let blockedByShift: string | null = null;
      let membershipType: 'FIXED' | 'FULL' | 'HALF' | null = null;

      /* 🥇 Priority 1 — FIXED seat */
      if (fixedMembership) {
        status = 'FIXED';
        student = {
          id: fixedMembership.student.id,
          name: fixedMembership.student.name,
          validTill: fixedMembership.endDate,
        };
        blockedByShift = 'FULL DAY';
        membershipType = 'FIXED';
      } else if (allocation) {
        /* 🥈 Priority 2 — FULL / MORNING / EVENING allocation */
        status = 'OCCUPIED';
        student = {
          id: allocation.student.id,
          name: allocation.student.name,
        };
        blockedByShift = allocation.shift.name;
        membershipType = allocation.shift.code === 'FULL_DAY' ? 'FULL' : 'HALF';
      }

      lab.rows[rowIndex].seats.push({
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        status,
        student,
        blockedByShift,
        membershipType, // 🆕 optional, frontend can ignore safely
      });
    }

    return Array.from(labMap.values());
  }

  // async assignSeat(
  //   dto: AssignSeatDto,
  //   admin?: { id: string; name: string }, // optional for now
  // ) {
  //   try {
  //     const dayStart = new Date(dto.date);
  //     dayStart.setHours(0, 0, 0, 0);

  //     const dayEnd = new Date(dto.date);
  //     dayEnd.setHours(23, 59, 59, 999);

  //     return await this.prisma.$transaction(async (tx) => {
  //       /* 1️⃣ Validate shift */
  //       const shift = await tx.shift.findUnique({
  //         where: { id: dto.shiftId },
  //         select: { id: true, code: true, name: true },
  //       });

  //       if (!shift) {
  //         throw new BadRequestException('Invalid shift');
  //       }

  //       /* 2️⃣ Validate active membership */
  //       const membership = await tx.membership.findFirst({
  //         where: {
  //           studentId: dto.studentId,
  //           isActive: true,
  //           shiftId: dto.shiftId,
  //           startDate: { lte: dayEnd },
  //           endDate: { gte: dayStart },
  //         },
  //         select: { id: true },
  //       });

  //       if (!membership) {
  //         throw new BadRequestException('Student has no active membership for this shift');
  //       }

  //       /* 2.5️⃣ HARD BLOCK: Student has fixed seat */
  //       const fixedMembership = await tx.membership.findFirst({
  //         where: {
  //           studentId: dto.studentId,
  //           isActive: true,
  //           shiftId: dto.shiftId,
  //           startDate: { lte: dayEnd },
  //           endDate: { gte: dayStart },
  //           fixedSeatId: { not: null },
  //         },
  //         select: {
  //           fixedSeatId: true,
  //         },
  //       });

  //       if (fixedMembership?.fixedSeatId) {
  //         throw new BadRequestException('Student already has a fixed seat for this membership');
  //       }

  //       /* 3️⃣ HARD BLOCK: student already has seat today */
  //       const existingStudentAllocation = await tx.dailySeatAllocation.findFirst({
  //         where: {
  //           studentId: dto.studentId,
  //           shiftId: dto.shiftId,
  //           date: dayStart,
  //         },
  //       });

  //       if (existingStudentAllocation) {
  //         throw new BadRequestException('Student already has a seat assigned for this shift');
  //       }

  //       /* 4️⃣ Validate seat */
  //       const seat = await tx.seat.findUnique({
  //         where: { id: dto.seatId },
  //         select: {
  //           id: true,
  //           labId: true,
  //           isFixedLocked: true,
  //         },
  //       });

  //       if (!seat) {
  //         throw new BadRequestException('Invalid seat');
  //       }

  //       if (seat.isFixedLocked) {
  //         throw new BadRequestException('This seat is fixed and cannot be assigned');
  //       }

  //       /* 5️⃣ Seat availability */
  //       const seatOccupied = await tx.dailySeatAllocation.findFirst({
  //         where: {
  //           seatId: dto.seatId,
  //           shiftId: dto.shiftId,
  //           date: dayStart,
  //         },
  //       });

  //       if (seatOccupied) {
  //         throw new BadRequestException('Seat already occupied');
  //       }

  //       /* 6️⃣ Create allocation */
  //       const allocation = await tx.dailySeatAllocation.create({
  //         data: {
  //           studentId: dto.studentId,
  //           seatId: dto.seatId,
  //           shiftId: dto.shiftId,
  //           date: dayStart,
  //           labId: seat.labId,
  //         },
  //       });

  //       /* 7️⃣ AUDIT LOG (✅ NOW REACHABLE) */
  //       await this.auditService.log({
  //         action: 'ASSIGN_SEAT',
  //         entity: 'Seat',
  //         entityId: dto.seatId,
  //         actorId: admin?.id,
  //         actorName: admin?.name ?? 'Admin',
  //         actorRole: 'ADMIN',
  //         description: `Seat assigned for ${shift.name}`,
  //         meta: {
  //           studentId: dto.studentId,
  //           seatId: dto.seatId,
  //           shiftCode: shift.code,
  //           date: dto.date,
  //         },
  //       });

  //       return allocation;
  //     });
  //   } catch (error) {
  //     if (error instanceof BadRequestException) throw error;
  //     throw new InternalServerErrorException('Failed to assign seat');
  //   }
  // }

  async assignSeat(dto: AssignSeatDto, admin?: { id: string; name: string }) {
    try {
      const dayStart = new Date(dto.date);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dto.date);
      dayEnd.setHours(23, 59, 59, 999);

      return await this.prisma.$transaction(async (tx) => {
        /* 1️⃣ Validate shift */
        const shift = await tx.shift.findUnique({
          where: { id: dto.shiftId },
          select: { id: true, code: true, name: true },
        });

        if (!shift) {
          throw new BadRequestException('Invalid shift');
        }

        /* 2️⃣ Validate active membership */
        const membership = await tx.membership.findFirst({
          where: {
            studentId: dto.studentId,
            isActive: true,
            shiftId: dto.shiftId,
            startDate: { lte: dayEnd },
            endDate: { gte: dayStart },
          },
          select: {
            id: true,
            fixedSeatId: true,
          },
        });

        if (!membership) {
          throw new BadRequestException(
            'Student has no active membership for this shift',
          );
        }

        /* 🚨 BLOCK: student has fixed seat */
        if (membership.fixedSeatId) {
          throw new BadRequestException(
            'Student has a fixed seat. Use fixed swap instead.',
          );
        }

        /* 3️⃣ HARD BLOCK: student already has seat today */
        const existingStudentAllocation =
          await tx.dailySeatAllocation.findFirst({
            where: {
              studentId: dto.studentId,
              shiftId: dto.shiftId,
              date: dayStart,
            },
          });

        if (existingStudentAllocation) {
          throw new BadRequestException(
            'Student already has a seat assigned for this shift',
          );
        }

        /* 4️⃣ Validate seat */
        const seat = await tx.seat.findUnique({
          where: { id: dto.seatId },
          select: {
            id: true,
            labId: true,
            isFixedLocked: true,
          },
        });

        if (!seat) {
          throw new BadRequestException('Invalid seat');
        }

        if (seat.isFixedLocked) {
          throw new BadRequestException(
            'This seat is fixed and cannot be assigned',
          );
        }

        /* 5️⃣ Seat availability */
        const seatOccupied = await tx.dailySeatAllocation.findFirst({
          where: {
            seatId: dto.seatId,
            shiftId: dto.shiftId,
            date: dayStart,
          },
        });

        if (seatOccupied) {
          throw new BadRequestException('Seat already occupied');
        }

        /* 6️⃣ Create allocation */
        const allocation = await tx.dailySeatAllocation.create({
          data: {
            studentId: dto.studentId,
            seatId: dto.seatId,
            shiftId: dto.shiftId,
            date: dayStart,
            labId: seat.labId,
          },
        });

        await this.auditService.log({
          action: 'ASSIGN_SEAT',
          entity: 'DailySeatAllocation',
          entityId: allocation.id,
          actorId: admin?.id,
          actorName: admin?.name ?? 'Admin',
          actorRole: 'ADMIN',
          description: `Seat assigned for ${shift.name}`,
          meta: dto,
        });

        return allocation;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to assign seat');
    }
  }
  async availableSeats(dto: SeatAvailabilityDto) {
    const date = dto.date ?? new Date().toISOString().split('T')[0];

    const allocationDate = new Date(date);
    allocationDate.setHours(0, 0, 0, 0);

    const seats = await this.prisma.seat.findMany({
      include: {
        lab: { select: { id: true, name: true } },
        allocations: {
          where: {
            date: allocationDate,
            shiftId: dto.shiftId,
          },
        },
      },
      orderBy: { seatNumber: 'asc' },
    });

    return seats
      .filter((s) => s.allocations.length === 0)
      .map((s) => ({
        seatId: s.id,
        seatNumber: s.seatNumber,
        labName: s.lab.name,
      }));
  }

  async unassignSeat(dto: UnassignSeatDto) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.dailySeatAllocation.findFirst({
        where: {
          date,
          shiftId: dto.shiftId,
          seatId: dto.seatId,
        },
      });

      if (!allocation) {
        throw new BadRequestException('Seat is already free');
      }

      await tx.dailySeatAllocation.delete({
        where: { id: allocation.id },
      });

      await tx.auditLog.create({
        data: {
          action: 'UNASSIGN_SEAT',
          entity: 'DailySeatAllocation',
          entityId: allocation.id,
          meta: allocation,
        },
      });

      return { message: 'Seat unassigned successfully' };
    });
  }

  async swapDailySeats(dto: SwapDailySeatDto) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    return this.prisma.$transaction(async (tx) => {
      /* 1️⃣ Get both allocations */
      const allocations = await tx.dailySeatAllocation.findMany({
        where: {
          date,
          shiftId: dto.shiftId,
          seatId: { in: [dto.seatIdA, dto.seatIdB] },
        },
      });

      if (allocations.length !== 2) {
        throw new BadRequestException('Both seats must be occupied to swap');
      }

      const [a, b] = allocations;

      /* 2️⃣ Temporary neutral seatId */
      const TEMP_UUID = crypto.randomUUID(); // fake UUID just for transaction

      /* 3️⃣ Move A to temporary seat (safe) */
      await tx.dailySeatAllocation.update({
        where: { id: a.id },
        data: { seatId: TEMP_UUID },
      });

      /* 4️⃣ Move B to A's seat */
      await tx.dailySeatAllocation.update({
        where: { id: b.id },
        data: { seatId: a.seatId },
      });

      /* 5️⃣ Move A to B's seat */
      await tx.dailySeatAllocation.update({
        where: { id: a.id },
        data: { seatId: b.seatId },
      });

      await this.auditService.log({
        action: 'SWAP_DAILY_SEATS',
        entity: 'DailySeatAllocation',
        entityId: '',
        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',
        description: `Seat swaped for ${a.id},${b.id}`,
        meta: dto,
      });

      return { message: 'Daily seats swapped successfully' };
    });
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async swapFixedSeat(dto: SwapFixedSeatDto) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: {
          studentId: dto.studentId,
          isActive: true,
          fixedSeatId: { not: null },
        },
        select: {
          id: true,
          fixedSeatId: true,
        },
      });

      if (!membership) {
        throw new BadRequestException('Student has no fixed seat membership');
      }

      const newSeat = await tx.seat.findUnique({
        where: { id: dto.newSeatId },
      });

      if (!newSeat) {
        throw new BadRequestException('Invalid seat');
      }

      if (newSeat.isFixedLocked) {
        throw new BadRequestException('Seat already fixed');
      }

      // unlock old seat
      await tx.seat.update({
        where: { id: membership.fixedSeatId! },
        data: { isFixedLocked: false },
      });

      // lock new seat
      await tx.seat.update({
        where: { id: dto.newSeatId },
        data: { isFixedLocked: true },
      });

      await tx.membership.update({
        where: { id: membership.id },
        data: { fixedSeatId: dto.newSeatId },
      });

      // await tx.auditLog.create({
      //   data: {
      //     action: 'SWAP_FIXED_SEAT',
      //     entity: 'Membership',
      //     entityId: membership.id,
      //     meta: dto,
      //   },
      // });
      await this.auditService.log({
        action: 'SWAP_FIXED_SEAT',
        entity: 'Membership',
        entityId: membership.id,
        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',
        description: `Seat assigned for membership ${membership.id}`,
        meta: dto,
      });

      return { message: 'Fixed seat swapped successfully' };
    });
  }
}
