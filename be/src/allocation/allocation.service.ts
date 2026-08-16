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
import { PrismaService } from '../prisma.service.js';

type TransactionClient =
  Extract<
    Parameters<PrismaService['$transaction']>[0],
    (tx: unknown) => unknown
  > extends (tx: infer T) => unknown
    ? T
    : never;

function isPrismaKnownRequestError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

type ShiftInfo = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
};

type SeatStudent = {
  id: string;
  name: string;
  validTill?: Date;
};

@Injectable()
export class AllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================
  // DATE HELPERS
  // ============================================================

  private normalizeDate(value: string | Date): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    date.setHours(0, 0, 0, 0);

    return date;
  }

  private getDayEnd(dayStart: Date): Date {
    const dayEnd = new Date(dayStart);

    dayEnd.setHours(23, 59, 59, 999);

    return dayEnd;
  }

  // ============================================================
  // SHIFT HELPERS
  // ============================================================

  private timeToMinutes(value: string): number {
    const match = /^(\d{2}):(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException(
        `Invalid shift time "${value}". Expected HH:mm.`,
      );
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new BadRequestException(
        `Invalid shift time "${value}". Expected HH:mm.`,
      );
    }

    return hours * 60 + minutes;
  }

  private validateShiftTimes(shift: ShiftInfo): void {
    const start = this.timeToMinutes(shift.startTime);
    const end = this.timeToMinutes(shift.endTime);

    if (end <= start) {
      throw new BadRequestException(`Invalid shift window for ${shift.name}`);
    }
  }

  /**
   * Two shifts conflict when their time windows overlap.
   *
   * Examples:
   * FULL_DAY 07:00-23:00
   * MORNING  07:00-15:00
   * EVENING  15:00-23:00
   *
   * FULL_DAY overlaps MORNING and EVENING.
   * MORNING does NOT overlap EVENING.
   */
  private shiftsOverlap(a: ShiftInfo, b: ShiftInfo): boolean {
    const aStart = this.timeToMinutes(a.startTime);
    const aEnd = this.timeToMinutes(a.endTime);

    const bStart = this.timeToMinutes(b.startTime);
    const bEnd = this.timeToMinutes(b.endTime);

    return aStart < bEnd && bStart < aEnd;
  }

  private async getShift(
    tx: TransactionClient,
    shiftId: string,
  ): Promise<ShiftInfo> {
    const shift = await tx.shift.findUnique({
      where: {
        id: shiftId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
        isActive: true,
      },
    });

    if (!shift || !shift.isActive) {
      throw new BadRequestException('Invalid or inactive shift');
    }

    this.validateShiftTimes(shift);

    return shift;
  }

  /**
   * Returns all active shifts that overlap the requested shift.
   */
  private async getBlockingShiftIds(
    tx: TransactionClient,
    requestedShift: ShiftInfo,
  ): Promise<string[]> {
    const shifts = await tx.shift.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
      },
    });

    return shifts
      .filter((shift) => {
        this.validateShiftTimes(shift);

        return this.shiftsOverlap(requestedShift, shift);
      })
      .map((shift: ShiftInfo) => shift.id);
  }

  private async getBlockingShiftCodes(
    tx: TransactionClient,
    requestedShift: ShiftInfo,
  ): Promise<string[]> {
    const shifts = await tx.shift.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
      },
    });

    return shifts
      .filter((shift) => {
        this.validateShiftTimes(shift);

        return this.shiftsOverlap(requestedShift, shift);
      })
      .map((shift: ShiftInfo) => shift.code);
  }

  // ============================================================
  // FIXED SEAT HELPERS
  // ============================================================

  /**
   * Finds a currently valid fixed-seat membership for a seat.
   *
   * The membership must:
   * - be active
   * - have this seat as fixedSeatId
   * - have started by the requested date
   * - not have expired before the requested date
   */
  private async findFixedMembershipForSeat(
    tx: TransactionClient,
    seatId: string,
    dayStart: Date,
    dayEnd: Date,
  ) {
    return tx.membership.findFirst({
      where: {
        isActive: true,
        fixedSeatId: seatId,

        startDate: {
          lte: dayEnd,
        },

        endDate: {
          gte: dayStart,
        },
      },

      select: {
        id: true,
        studentId: true,
        endDate: true,

        student: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Finds an allocation on a seat for one of the shifts
   * that overlaps the requested shift.
   */
  private async findConflictingAllocation(
    tx: TransactionClient,
    params: {
      seatId: string;
      date: Date;
      blockingShiftIds: string[];
    },
  ) {
    return tx.dailySeatAllocation.findFirst({
      where: {
        seatId: params.seatId,
        date: params.date,

        shiftId: {
          in: params.blockingShiftIds,
        },
      },

      include: {
        shift: {
          select: {
            id: true,
            code: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },

        student: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // ============================================================
  // RUN DAILY ALLOCATION
  // ============================================================

  async runAllocation(dto: RunAllocationDto) {
    const allocationDate = this.normalizeDate(dto.date);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const shift = await this.getShift(tx, dto.shiftId);

        const dayEnd = this.getDayEnd(allocationDate);

        /**
         * Only memberships belonging to the selected shift
         * participate in this run.
         *
         * Fixed-seat memberships are intentionally excluded
         * because their seat is already reserved.
         */
        const memberships = await tx.membership.findMany({
          where: {
            isActive: true,

            shiftId: shift.id,

            fixedSeatId: null,

            startDate: {
              lte: dayEnd,
            },

            endDate: {
              gte: allocationDate,
            },
          },

          orderBy: [
            {
              startDate: 'asc',
            },
            {
              studentId: 'asc',
            },
          ],

          select: {
            id: true,
            studentId: true,
          },
        });

        /**
         * Re-running allocation for the same shift/date
         * should reset that shift's previous automatic
         * allocation before rebuilding it.
         *
         * Other non-overlapping shifts remain untouched.
         */
        await tx.dailySeatAllocation.deleteMany({
          where: {
            date: allocationDate,
            shiftId: shift.id,
          },
        });

        if (memberships.length === 0) {
          return {
            message: 'No memberships to allocate',
            allocated: 0,
          };
        }

        /**
         * FULL_DAY blocks MORNING + EVENING.
         *
         * MORNING blocks only MORNING.
         *
         * EVENING blocks only EVENING.
         */
        const blockingShiftIds = await this.getBlockingShiftIds(tx, shift);

        /**
         * Existing allocations from overlapping shifts
         * cannot be reused.
         */
        const occupiedAllocations = await tx.dailySeatAllocation.findMany({
          where: {
            date: allocationDate,

            shiftId: {
              in: blockingShiftIds,
            },
          },

          select: {
            seatId: true,
          },
        });

        const occupiedSeatIds = new Set(
          occupiedAllocations.map((allocation) => allocation.seatId),
        );

        /**
         * Find currently valid fixed seats.
         *
         * A fixed seat blocks the entire day while the
         * membership is valid.
         */
        const fixedSeats = await tx.membership.findMany({
          where: {
            isActive: true,

            fixedSeatId: {
              not: null,
            },

            startDate: {
              lte: dayEnd,
            },

            endDate: {
              gte: allocationDate,
            },
          },

          select: {
            fixedSeatId: true,
          },
        });

        const fixedSeatIds = new Set(
          fixedSeats
            .map((membership) => membership.fixedSeatId)
            .filter((id: string | null): id is string => !!id),
        );

        /**
         * Only normal seats can be automatically allocated.
         *
         * Fixed-seat memberships are excluded above.
         *
         * isFixedLocked is also respected as a physical/manual
         * lock in the database.
         */
        const seats = await tx.seat.findMany({
          where: {
            isFixedLocked: false,

            id: {
              notIn: Array.from(fixedSeatIds),
            },
          },

          orderBy: [
            {
              labId: 'asc',
            },
            {
              seatNumber: 'asc',
            },
          ],

          select: {
            id: true,
            labId: true,
          },
        });

        const availableSeats = seats.filter(
          (seat: { id: string; labId: string }) =>
            !occupiedSeatIds.has(seat.id),
        );

        if (availableSeats.length < memberships.length) {
          throw new BadRequestException(
            `Not enough seats available for ${shift.name}. Required: ${memberships.length}, Available: ${availableSeats.length}`,
          );
        }

        const allocations = memberships.map(
          (
            membership: {
              id: string;
              studentId: string;
            },
            index: number,
          ) => ({
            date: allocationDate,

            studentId: membership.studentId,

            seatId: availableSeats[index].id,

            labId: availableSeats[index].labId,

            shiftId: shift.id,
          }),
        );

        await tx.dailySeatAllocation.createMany({
          data: allocations,
        });

        await this.auditService.log({
          action: 'RUN_SEAT_ALLOCATION',

          entity: 'DailySeatAllocation',

          entityId: '',

          actorId: '',

          actorName: 'Admin',

          actorRole: 'ADMIN',

          description: `Daily seat allocation completed for ${shift.name}`,

          meta: {
            date: dto.date,
            shiftId: shift.id,
            shiftCode: shift.code,
            allocated: allocations.length,
          },
        });

        return {
          message: 'Seat allocation completed',

          allocated: allocations.length,
        };
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (isPrismaKnownRequestError(error) && error.code === 'P2034') {
        throw new BadRequestException(
          'Seat allocation changed at the same time. Please retry.',
        );
      }

      throw new InternalServerErrorException('Failed to run seat allocation');
    }
  }

  // ============================================================
  // GET ALLOCATIONS
  // ============================================================

  async getAllocations(date: string, shiftId: string) {
    const allocationDate = this.normalizeDate(date);

    const shift = await this.prisma.shift.findFirst({
      where: {
        id: shiftId,
        isActive: true,
      },

      select: {
        id: true,
      },
    });

    if (!shift) {
      throw new BadRequestException('Invalid or inactive shift');
    }

    const allocations = await this.prisma.dailySeatAllocation.findMany({
      where: {
        date: allocationDate,
        shiftId,
      },

      include: {
        student: {
          select: {
            id: true,
            name: true,
          },
        },

        seat: {
          select: {
            id: true,
            seatNumber: true,
            labId: true,
          },
        },

        lab: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        seat: {
          seatNumber: 'asc',
        },
      },
    });

    return allocations.map((allocation) => ({
      allocationId: allocation.id,

      seatId: allocation.seat.id,

      seatNumber: allocation.seat.seatNumber,

      labName: allocation.lab.name,

      student: {
        id: allocation.student.id,

        name: allocation.student.name,
      },
    }));
  }

  // ============================================================
  // SEAT MAP
  // ============================================================

  async seatMap(date: string, shiftId: string) {
    const allocationDate = this.normalizeDate(date);
    const dayEnd = this.getDayEnd(allocationDate);

    const shift = await this.prisma.shift.findUnique({
      where: {
        id: shiftId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
        isActive: true,
      },
    });

    if (!shift || !shift.isActive) {
      throw new BadRequestException('Invalid or inactive shift');
    }

    this.validateShiftTimes(shift);

    const blockingShiftCodes = await this.getBlockingShiftCodes(
      this.prisma,
      shift,
    );

    const seats = await this.prisma.seat.findMany({
      include: {
        lab: {
          select: {
            id: true,
            name: true,
          },
        },

        allocations: {
          where: {
            date: allocationDate,
            shift: {
              code: {
                in: blockingShiftCodes,
              },
            },
          },

          include: {
            shift: {
              select: {
                id: true,
                code: true,
                name: true,
                startTime: true,
                endTime: true,
              },
            },

            student: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          orderBy: [
            {
              shift: {
                code: 'asc',
              },
            },
          ],
        },

        memberships: {
          where: {
            isActive: true,

            fixedSeatId: {
              not: null,
            },

            startDate: {
              lte: dayEnd,
            },

            endDate: {
              gte: allocationDate,
            },
          },

          select: {
            id: true,
            endDate: true,

            student: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          take: 1,
        },
      },

      orderBy: [
        {
          labId: 'asc',
        },
        {
          seatNumber: 'asc',
        },
      ],
    });

    const SEATS_PER_ROW = 6;

    type SeatMapSeat = {
      seatId: string;
      seatNumber: number;
      status: 'FIXED' | 'FREE' | 'OCCUPIED';
      student: SeatStudent | null;
      blockedByShift: string | null;
      membershipType: 'FIXED' | 'FULL' | 'HALF' | null;
      occupants: Array<{
        allocationId?: string;
        studentId: string;
        studentName: string;
        shiftId?: string;
        shiftCode: string;
        shiftName: string;
        validTill?: Date;
        membershipType: 'FIXED' | 'FULL' | 'HALF';
      }>;
    };

    type SeatMapRow = {
      rowNumber: number;
      seats: SeatMapSeat[];
    };

    type SeatMapLab = {
      labId: string;
      labName: string;
      rows: SeatMapRow[];
    };

    const labMap = new Map<string, SeatMapLab>();

    for (const seat of seats) {
      if (!labMap.has(seat.lab.id)) {
        labMap.set(seat.lab.id, {
          labId: seat.lab.id,
          labName: seat.lab.name,
          rows: [],
        });
      }

      const lab = labMap.get(seat.lab.id);

      if (!lab) {
        continue;
      }

      const rowIndex = Math.floor((seat.seatNumber - 1) / SEATS_PER_ROW);

      if (!lab.rows[rowIndex]) {
        lab.rows[rowIndex] = {
          rowNumber: rowIndex + 1,
          seats: [],
        };
      }

      const fixedMembership = seat.memberships[0] ?? null;

      const allocations = seat.allocations ?? [];

      /*
       * Fixed seat always has priority.
       *
       * A fixed seat blocks the physical seat for
       * the entire day.
       */
      if (fixedMembership) {
        const student = {
          id: fixedMembership.student.id,
          name: fixedMembership.student.name,
          validTill: fixedMembership.endDate,
        };

        lab.rows[rowIndex].seats.push({
          seatId: seat.id,
          seatNumber: seat.seatNumber,

          status: 'FIXED',

          student,

          blockedByShift: 'FULL DAY',

          membershipType: 'FIXED',

          occupants: [
            {
              studentId: fixedMembership.student.id,
              studentName: fixedMembership.student.name,
              shiftCode: 'FULL_DAY',
              shiftName: 'Full Day',
              validTill: fixedMembership.endDate,
              membershipType: 'FIXED',
            },
          ],
        });

        continue;
      }

      /*
       * All allocations relevant to the requested shift.
       *
       * For:
       *
       * MORNING
       *   → Morning allocation
       *
       * EVENING
       *   → Evening allocation
       *
       * FULL_DAY
       *   → Full Day + Morning + Evening
       */
      const occupants = allocations.map((allocation) => ({
        allocationId: allocation.id,

        studentId: allocation.student.id,

        studentName: allocation.student.name,

        shiftId: allocation.shift.id,

        shiftCode: allocation.shift.code,

        shiftName: allocation.shift.name,

        membershipType:
          allocation.shift.code === 'FULL_DAY'
            ? ('FULL' as const)
            : ('HALF' as const),
      }));

      /*
       * No allocation.
       */
      if (occupants.length === 0) {
        lab.rows[rowIndex].seats.push({
          seatId: seat.id,
          seatNumber: seat.seatNumber,

          status: 'FREE',

          student: null,

          blockedByShift: null,

          membershipType: null,

          occupants: [],
        });

        continue;
      }

      /*
       * Choose a primary student for backward compatibility.
       *
       * Existing frontend code expects:
       *
       * seat.student
       * seat.blockedByShift
       * seat.membershipType
       *
       * For FULL_DAY view:
       *
       * 1. Full Day allocation gets priority.
       * 2. Otherwise first allocation is used.
       */
      const primaryAllocation =
        allocations.find(
          (allocation) => allocation.shift.code === 'FULL_DAY',
        ) ?? allocations[0];

      if (!primaryAllocation) {
        continue;
      }

      const primaryStudent = {
        id: primaryAllocation.student.id,
        name: primaryAllocation.student.name,
      };

      const primaryMembershipType =
        primaryAllocation.shift.code === 'FULL_DAY' ? 'FULL' : 'HALF';

      /*
       * Existing fields remain intact.
       *
       * New field:
       *
       * occupants
       *
       * gives Full Day view the complete picture.
       */
      lab.rows[rowIndex].seats.push({
        seatId: seat.id,
        seatNumber: seat.seatNumber,

        status: 'OCCUPIED',

        student: primaryStudent,

        blockedByShift:
          occupants.length === 1
            ? primaryAllocation.shift.name
            : occupants.map((occupant) => occupant.shiftName).join(' + '),

        membershipType: primaryMembershipType,

        occupants,
      });
    }

    return Array.from(labMap.values());
  }

  // ============================================================
  // ASSIGN SEAT MANUALLY
  // ============================================================

  async assignSeat(
    dto: AssignSeatDto,
    admin?: {
      id: string;
      name: string;
    },
  ) {
    const dayStart = this.normalizeDate(dto.date);

    const dayEnd = this.getDayEnd(dayStart);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const shift = await this.getShift(tx, dto.shiftId);

        /**
         * Student must have an active membership for
         * the selected shift and date.
         */
        const membership = await tx.membership.findFirst({
          where: {
            studentId: dto.studentId,

            isActive: true,

            shiftId: dto.shiftId,

            startDate: {
              lte: dayEnd,
            },

            endDate: {
              gte: dayStart,
            },
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

        /**
         * A fixed-seat student cannot manually receive
         * another daily seat.
         */
        if (membership.fixedSeatId) {
          throw new BadRequestException(
            'Student has a fixed seat. Use fixed-seat swap instead.',
          );
        }

        const blockingShiftIds = await this.getBlockingShiftIds(tx, shift);

        /**
         * Student cannot have another allocation during
         * an overlapping time window.
         */
        const existingStudentAllocation =
          await tx.dailySeatAllocation.findFirst({
            where: {
              studentId: dto.studentId,

              date: dayStart,

              shiftId: {
                in: blockingShiftIds,
              },
            },

            include: {
              shift: {
                select: {
                  name: true,
                },
              },
            },
          });

        if (existingStudentAllocation) {
          throw new BadRequestException(
            `Student already has a seat assigned for ${existingStudentAllocation.shift.name}`,
          );
        }

        const seat = await tx.seat.findUnique({
          where: {
            id: dto.seatId,
          },

          select: {
            id: true,
            labId: true,
            seatNumber: true,
            isFixedLocked: true,
          },
        });

        if (!seat) {
          throw new BadRequestException('Invalid seat');
        }

        /**
         * Physical/manual fixed lock.
         */
        if (seat.isFixedLocked) {
          throw new BadRequestException(
            'This seat is fixed and cannot be assigned',
          );
        }

        /**
         * Actual membership-based fixed reservation.
         */
        const fixedMembership = await this.findFixedMembershipForSeat(
          tx,
          seat.id,
          dayStart,
          dayEnd,
        );

        if (fixedMembership) {
          throw new BadRequestException(
            `Seat is fixed for ${fixedMembership.student.name}`,
          );
        }

        /**
         * Existing allocation in an overlapping shift
         * blocks the seat.
         *
         * MORNING + EVENING are allowed to share.
         * FULL_DAY blocks both.
         */
        const conflictingAllocation = await this.findConflictingAllocation(tx, {
          seatId: seat.id,

          date: dayStart,

          blockingShiftIds,
        });

        if (conflictingAllocation) {
          throw new BadRequestException(
            `Seat ${seat.seatNumber} is occupied for ${conflictingAllocation.shift.name}`,
          );
        }

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

          actorId: admin?.id ?? '',

          actorName: admin?.name ?? 'Admin',

          actorRole: 'ADMIN',

          description: `Seat ${seat.seatNumber} assigned for ${shift.name}`,

          meta: {
            ...dto,

            shiftCode: shift.code,

            shiftName: shift.name,
          },
        });

        return allocation;
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (isPrismaKnownRequestError(error) && error.code === 'P2034') {
        throw new BadRequestException(
          'Seat allocation changed at the same time. Please retry.',
        );
      }

      if (isPrismaKnownRequestError(error) && error.code === 'P2002') {
        throw new BadRequestException(
          'This seat is already assigned for the selected time period.',
        );
      }

      throw new InternalServerErrorException('Failed to assign seat');
    }
  }

  // ============================================================
  // AVAILABLE SEATS
  // ============================================================

  async availableSeats(dto: SeatAvailabilityDto) {
    const date = dto.date ?? new Date().toISOString().split('T')[0];

    const allocationDate = this.normalizeDate(date);

    const dayEnd = this.getDayEnd(allocationDate);

    const shift = await this.prisma.shift.findUnique({
      where: {
        id: dto.shiftId,
      },

      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
        isActive: true,
      },
    });

    if (!shift || !shift.isActive) {
      throw new BadRequestException('Invalid or inactive shift');
    }

    this.validateShiftTimes(shift);

    const activeShifts = await this.prisma.shift.findMany({
      where: {
        isActive: true,
      },

      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
      },
    });

    const blockingShiftIds = activeShifts
      .filter((candidate) => {
        this.validateShiftTimes(candidate);

        return this.shiftsOverlap(shift, candidate);
      })
      .map((candidate: ShiftInfo) => candidate.id);

    const seats = await this.prisma.seat.findMany({
      where: {
        isFixedLocked: false,
      },

      include: {
        lab: {
          select: {
            id: true,
            name: true,
          },
        },

        allocations: {
          where: {
            date: allocationDate,

            shiftId: {
              in: blockingShiftIds,
            },
          },

          select: {
            id: true,
          },
        },

        memberships: {
          where: {
            isActive: true,

            fixedSeatId: {
              not: null,
            },

            startDate: {
              lte: dayEnd,
            },

            endDate: {
              gte: allocationDate,
            },
          },

          select: {
            id: true,
          },
        },
      },

      orderBy: [
        {
          labId: 'asc',
        },
        {
          seatNumber: 'asc',
        },
      ],
    });

    return seats
      .filter(
        (seat) =>
          seat.allocations.length === 0 && seat.memberships.length === 0,
      )
      .map((seat) => ({
        seatId: seat.id,

        seatNumber: seat.seatNumber,

        labName: seat.lab.name,
      }));
  }

  // ============================================================
  // UNASSIGN
  // ============================================================

  async unassignSeat(dto: UnassignSeatDto) {
    const date = this.normalizeDate(dto.date);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const allocation = await tx.dailySeatAllocation.findFirst({
          where: {
            date,

            shiftId: dto.shiftId,

            seatId: dto.seatId,
          },

          include: {
            shift: {
              select: {
                name: true,
              },
            },

            student: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!allocation) {
          throw new BadRequestException('Seat is already free');
        }

        const fixedMembership = await this.findFixedMembershipForSeat(
          tx,
          dto.seatId,
          date,
          this.getDayEnd(date),
        );

        if (fixedMembership) {
          throw new BadRequestException(
            'This seat is fixed and cannot be modified through daily allocation',
          );
        }

        await tx.dailySeatAllocation.delete({
          where: {
            id: allocation.id,
          },
        });

        await this.auditService.log({
          action: 'UNASSIGN_SEAT',

          entity: 'DailySeatAllocation',

          entityId: allocation.id,

          actorId: '',

          actorName: 'Admin',

          actorRole: 'ADMIN',

          description: `Seat unassigned for ${allocation.shift.name}`,

          meta: {
            allocationId: allocation.id,

            studentId: allocation.studentId,

            seatId: allocation.seatId,

            shiftId: allocation.shiftId,

            date: dto.date,
          },
        });

        return {
          message: 'Seat unassigned successfully',
        };
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (isPrismaKnownRequestError(error) && error.code === 'P2034') {
        throw new BadRequestException(
          'Seat allocation changed at the same time. Please retry.',
        );
      }

      throw new InternalServerErrorException('Failed to unassign seat');
    }
  }

  // ============================================================
  // DAILY SEAT SWAP
  // ============================================================

  async swapDailySeats(dto: SwapDailySeatDto) {
    if (dto.seatIdA === dto.seatIdB) {
      throw new BadRequestException('Cannot swap a seat with itself');
    }

    const date = this.normalizeDate(dto.date);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const shift = await this.getShift(tx, dto.shiftId);

        const allocations = await tx.dailySeatAllocation.findMany({
          where: {
            date,

            shiftId: dto.shiftId,

            seatId: {
              in: [dto.seatIdA, dto.seatIdB],
            },
          },
        });

        if (allocations.length !== 2) {
          throw new BadRequestException(
            'Both seats must be occupied for this shift',
          );
        }

        const allocationA = allocations.find(
          (allocation) => allocation.seatId === dto.seatIdA,
        );

        const allocationB = allocations.find(
          (allocation) => allocation.seatId === dto.seatIdB,
        );

        if (!allocationA || !allocationB) {
          throw new BadRequestException(
            'Both seats must be occupied for this shift',
          );
        }

        /**
         * Fixed seats cannot participate in a daily swap.
         */
        const fixedMembershipA = await this.findFixedMembershipForSeat(
          tx,
          dto.seatIdA,
          date,
          this.getDayEnd(date),
        );

        const fixedMembershipB = await this.findFixedMembershipForSeat(
          tx,
          dto.seatIdB,
          date,
          this.getDayEnd(date),
        );

        if (fixedMembershipA || fixedMembershipB) {
          throw new BadRequestException(
            'Fixed seats cannot be swapped through daily allocation',
          );
        }

        /**
         * Direct SQL swap avoids a temporary duplicate
         * seat assignment if a unique constraint exists.
         */
        await tx.$executeRaw`
            UPDATE "DailySeatAllocation"
            SET "seatId" = CASE
              WHEN "id" = ${allocationA.id}
                THEN ${allocationB.seatId}
              WHEN "id" = ${allocationB.id}
                THEN ${allocationA.seatId}
              ELSE "seatId"
            END
            WHERE "id" IN (
              ${allocationA.id},
              ${allocationB.id}
            )
          `;

        await this.auditService.log({
          action: 'SWAP_DAILY_SEATS',

          entity: 'DailySeatAllocation',

          entityId: allocationA.id,

          actorId: '',

          actorName: 'Admin',

          actorRole: 'ADMIN',

          description: `Daily seats swapped for ${shift.name}`,

          meta: {
            ...dto,

            allocationAId: allocationA.id,

            allocationBId: allocationB.id,
          },
        });

        return {
          message: 'Daily seats swapped successfully',
        };
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (isPrismaKnownRequestError(error) && error.code === 'P2034') {
        throw new BadRequestException(
          'Seat allocation changed at the same time. Please retry.',
        );
      }

      throw new InternalServerErrorException('Failed to swap daily seats');
    }
  }

  // ============================================================
  // FIXED SEAT SWAP
  // ============================================================

  async swapFixedSeat(dto: SwapFixedSeatDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await tx.membership.findFirst({
          where: {
            studentId: dto.studentId,

            isActive: true,

            fixedSeatId: {
              not: null,
            },
          },

          select: {
            id: true,
            fixedSeatId: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!membership || !membership.fixedSeatId) {
          throw new BadRequestException(
            'Student has no active fixed-seat membership',
          );
        }

        if (membership.fixedSeatId === dto.newSeatId) {
          throw new BadRequestException('Student already has this fixed seat');
        }

        const newSeat = await tx.seat.findUnique({
          where: {
            id: dto.newSeatId,
          },

          select: {
            id: true,
            seatNumber: true,
            labId: true,
            isFixedLocked: true,
          },
        });

        if (!newSeat) {
          throw new BadRequestException('Invalid new seat');
        }

        /**
         * The new seat must not already be physically
         * locked by another fixed-seat configuration.
         *
         * The existing student's current seat is allowed
         * to remain locked until the swap is completed.
         */
        if (newSeat.isFixedLocked) {
          const existingFixedMembership = await tx.membership.findFirst({
            where: {
              isActive: true,

              fixedSeatId: dto.newSeatId,

              id: {
                not: membership.id,
              },

              startDate: {
                lte: membership.endDate,
              },

              endDate: {
                gte: membership.startDate,
              },
            },

            select: {
              id: true,
            },
          });

          if (existingFixedMembership) {
            throw new BadRequestException(
              'New seat is already reserved by another fixed-seat membership',
            );
          }

          /**
           * If isFixedLocked is stale but no valid
           * membership owns it, we allow the swap and
           * normalize the lock below.
           */
        }

        /**
         * Another fixed membership cannot overlap
         * this membership period.
         */
        const membershipConflict = await tx.membership.findFirst({
          where: {
            isActive: true,

            fixedSeatId: dto.newSeatId,

            id: {
              not: membership.id,
            },

            startDate: {
              lte: membership.endDate,
            },

            endDate: {
              gte: membership.startDate,
            },
          },

          select: {
            id: true,
          },
        });

        if (membershipConflict) {
          throw new BadRequestException(
            'New seat is already reserved by another fixed-seat membership',
          );
        }

        /**
         * A daily allocation anywhere inside the membership
         * period cannot occupy the new fixed seat.
         */
        const allocationConflict = await tx.dailySeatAllocation.findFirst({
          where: {
            seatId: dto.newSeatId,

            date: {
              gte: this.normalizeDate(membership.startDate),

              lte: this.normalizeDate(membership.endDate),
            },
          },

          include: {
            shift: {
              select: {
                name: true,
              },
            },
          },
        });

        if (allocationConflict) {
          throw new BadRequestException(
            `New seat has a daily allocation during the membership period (${allocationConflict.shift.name})`,
          );
        }

        /**
         * Unlock old fixed seat.
         */
        await tx.seat.update({
          where: {
            id: membership.fixedSeatId,
          },

          data: {
            isFixedLocked: false,
          },
        });

        /**
         * Lock new fixed seat.
         */
        await tx.seat.update({
          where: {
            id: dto.newSeatId,
          },

          data: {
            isFixedLocked: true,
          },
        });

        /**
         * Move membership reservation.
         */
        await tx.membership.update({
          where: {
            id: membership.id,
          },

          data: {
            fixedSeatId: dto.newSeatId,
          },
        });

        await this.auditService.log({
          action: 'SWAP_FIXED_SEAT',

          entity: 'Membership',

          entityId: membership.id,

          actorId: '',

          actorName: 'Admin',

          actorRole: 'ADMIN',

          description: `Fixed seat changed for membership ${membership.id}`,

          meta: {
            studentId: dto.studentId,

            oldSeatId: membership.fixedSeatId,

            newSeatId: dto.newSeatId,
          },
        });

        return {
          message: 'Fixed seat swapped successfully',
        };
      });
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (isPrismaKnownRequestError(error) && error.code === 'P2034') {
        throw new BadRequestException(
          'Seat allocation changed at the same time. Please retry.',
        );
      }

      throw new InternalServerErrorException('Failed to swap fixed seat');
    }
  }

  // ============================================================
  // AUDIT LOGS
  // ============================================================

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },

      take: 50,
    });
  }
}
