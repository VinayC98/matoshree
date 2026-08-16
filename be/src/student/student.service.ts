import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createStudent(dto: CreateStudentDto) {
    try {
      const existing = await this.prisma.student.findUnique({
        where: {
          mobile: dto.mobile,
        },
      });

      if (existing) {
        throw new ConflictException('Student with this mobile already exists');
      }

      const addStudent = await this.prisma.student.create({
        data: dto,
      });

      await this.auditService.log({
        action: 'CREATE_STUDENT',
        entity: 'Student',
        entityId: addStudent.id,
        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',
        description: 'Student Created Successfully.',
        meta: {
          StudentInfo: addStudent,
        },
      });

      return addStudent;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create student');
    }
  }

  async getAllStudents() {
    try {
      return await this.prisma.student.findMany({
        include: {
          memberships: {
            where: {
              isActive: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch {
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  async getStudentById(id: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: {
          id,
        },
        include: {
          memberships: true,
          payments: true,
        },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      return student;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to fetch student');
    }
  }

  private calculateAccount(
    charges: Array<{
      amountDue: number;
      status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
      allocations: Array<{
        amount: number;
      }>;
    }>,
  ) {
    let totalDue = 0;
    let totalPaid = 0;

    for (const charge of charges) {
      if (charge.status === 'CANCELLED') {
        continue;
      }

      totalDue += charge.amountDue;

      for (const allocation of charge.allocations) {
        totalPaid += allocation.amount;
      }
    }

    const outstanding = Math.max(totalDue - totalPaid, 0);

    let status: 'YET_TO_PAY' | 'PARTIAL' | 'PAID';

    if (totalPaid === 0) {
      status = 'YET_TO_PAY';
    } else if (outstanding === 0) {
      status = 'PAID';
    } else {
      status = 'PARTIAL';
    }

    return {
      totalDue,
      totalPaid,
      outstanding,
      status,
    };
  }

  async getStudents(page: string, limit: string, search: string = '') {
    try {
      const pageNumber = Math.max(Number(page) || 1, 1);

      const requestedPageSize = Math.max(Number(limit) || 10, 1);

      const pageSize = Math.min(requestedPageSize, 100);

      const skip = (pageNumber - 1) * pageSize;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const tomorrowStart = new Date(todayStart);

      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      const trimmedSearch = search.trim();

      const where: Prisma.StudentWhereInput = trimmedSearch
        ? {
            OR: [
              {
                name: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
              {
                mobile: {
                  contains: trimmedSearch,
                },
              },
            ],
          }
        : {};

      const [total, students] = await Promise.all([
        this.prisma.student.count({
          where,
        }),

        this.prisma.student.findMany({
          where,

          skip,
          take: pageSize,

          orderBy: {
            createdAt: 'desc',
          },

          include: {
            memberships: {
              where: {
                isActive: true,
                endDate: {
                  gte: todayStart,
                },
              },

              orderBy: {
                endDate: 'desc',
              },

              take: 1,

              include: {
                membershipPlan: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    requiresFixedSeat: true,
                    isSeatDailyAssigned: true,
                  },
                },

                shift: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },

                fixedSeat: {
                  include: {
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

                  select: {
                    id: true,
                    type: true,
                    amountDue: true,
                    status: true,
                    periodStart: true,
                    periodEnd: true,
                    dueDate: true,

                    allocations: {
                      select: {
                        amount: true,
                      },
                    },
                  },

                  orderBy: {
                    createdAt: 'asc',
                  },
                },
              },
            },

            allocations: {
              where: {
                date: {
                  gte: todayStart,
                  lt: tomorrowStart,
                },
              },

              orderBy: {
                date: 'asc',
              },

              take: 1,

              include: {
                seat: {
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

                shift: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const data = students.map((student) => {
        const membership = student.memberships[0] ?? null;

        let seatLabel: string | null = null;

        let seat: {
          id: string;
          seatNumber: number;
          lab: {
            id: string;
            name: string;
          };
          type: 'FIXED' | 'DAILY';
        } | null = null;

        if (membership?.fixedSeat) {
          seatLabel = `${membership.fixedSeat.lab.name} - Seat ${membership.fixedSeat.seatNumber}`;

          seat = {
            id: membership.fixedSeat.id,
            seatNumber: membership.fixedSeat.seatNumber,
            lab: {
              id: membership.fixedSeat.lab.id,
              name: membership.fixedSeat.lab.name,
            },
            type: 'FIXED',
          };
        } else {
          const dailyAllocation = student.allocations[0] ?? null;

          if (dailyAllocation) {
            seatLabel = `${dailyAllocation.seat.lab.name} - Seat ${dailyAllocation.seat.seatNumber}`;

            seat = {
              id: dailyAllocation.seat.id,
              seatNumber: dailyAllocation.seat.seatNumber,
              lab: {
                id: dailyAllocation.seat.lab.id,
                name: dailyAllocation.seat.lab.name,
              },
              type: 'DAILY',
            };
          }
        }

        if (!membership) {
          return {
            id: student.id,
            name: student.name,
            mobile: student.mobile,
            createdAt: student.createdAt.toISOString(),

            hasActiveMembership: false,

            paymentStatus: 'YET_TO_PAY' as const,

            account: {
              totalDue: 0,
              totalPaid: 0,
              outstanding: 0,
            },

            activeMembership: null,

            seat: seatLabel,
            seatDetails: seat,
          };
        }

        const account = this.calculateAccount(membership.charges);

        return {
          id: student.id,
          name: student.name,
          mobile: student.mobile,
          createdAt: student.createdAt.toISOString(),

          hasActiveMembership: true,

          paymentStatus: account.status,

          account: {
            totalDue: account.totalDue,

            totalPaid: account.totalPaid,

            outstanding: account.outstanding,
          },

          activeMembership: {
            id: membership.id,

            planName: membership.membershipPlan.name,

            planCode: membership.membershipPlan.code,

            planId: membership.membershipPlan.id,

            shiftName: membership.shift.name,

            shiftCode: membership.shift.code,

            shiftId: membership.shift.id,

            startDate: membership.startDate.toISOString(),

            endDate: membership.endDate.toISOString(),

            requiresFixedSeat: membership.membershipPlan.requiresFixedSeat,

            isSeatDailyAssigned: membership.membershipPlan.isSeatDailyAssigned,
          },

          seat: seatLabel,
          seatDetails: seat,
        };
      });

      const totalPages = Math.ceil(total / pageSize);

      return {
        data,

        pagination: {
          page: pageNumber,
          limit: pageSize,
          total,
          totalPages,

          hasNextPage: pageNumber < totalPages,

          hasPreviousPage: pageNumber > 1,
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  async getStudentDetails(studentId: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: {
          id: studentId,
        },

        select: {
          id: true,
          name: true,
          mobile: true,
          createdAt: true,
        },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const [memberships, payments, allocations] = await Promise.all([
        this.prisma.membership.findMany({
          where: {
            studentId,
          },

          orderBy: {
            startDate: 'desc',
          },

          include: {
            membershipPlan: {
              select: {
                id: true,
                name: true,
                code: true,
                requiresFixedSeat: true,
                isSeatDailyAssigned: true,
              },
            },

            shift: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },

            fixedSeat: {
              include: {
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

              orderBy: {
                createdAt: 'asc',
              },

              include: {
                allocations: {
                  select: {
                    id: true,
                    amount: true,
                    paymentId: true,
                  },
                },
              },
            },
          },
        }),

        this.prisma.payment.findMany({
          where: {
            studentId,
          },

          orderBy: {
            paidOn: 'desc',
          },
        }),

        this.prisma.dailySeatAllocation.findMany({
          where: {
            studentId,
          },

          orderBy: {
            date: 'desc',
          },

          include: {
            shift: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },

            seat: {
              include: {
                lab: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const activeMembership =
        memberships.find(
          (membership) =>
            membership.isActive && membership.endDate >= new Date(),
        ) ?? null;

      const account = activeMembership
        ? this.calculateAccount(activeMembership.charges)
        : {
            totalDue: 0,
            totalPaid: 0,
            outstanding: 0,
            status: 'YET_TO_PAY' as const,
          };

      return {
        student,

        memberships,

        payments,

        allocations,

        account: {
          totalDue: account.totalDue,

          totalPaid: account.totalPaid,

          outstanding: account.outstanding,

          status: account.status,
        },

        activeMembershipId: activeMembership?.id ?? null,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Failed to fetch student details:', error);

      throw new InternalServerErrorException('Failed to fetch student details');
    }
  }

  async getStudentOptions() {
    try {
      return await this.prisma.student.findMany({
        select: {
          id: true,
          name: true,
          mobile: true,
        },

        orderBy: {
          name: 'asc',
        },
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to fetch student options');
    }
  }

  async searchStudentOptions(params: {
    search?: string;
    limit?: string;
    hasActiveMembership?: string;
  }) {
    try {
      const search = params.search?.trim() ?? '';

      const parsedLimit = Number(params.limit) || 10;

      const limit = Math.min(Math.max(parsedLimit, 1), 20);

      const now = new Date();

      const where: Prisma.StudentWhereInput = {};

      if (search) {
        where.OR = [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            mobile: {
              contains: search,
            },
          },
        ];
      }

      if (params.hasActiveMembership === 'true') {
        where.memberships = {
          some: {
            isActive: true,
            endDate: {
              gte: now,
            },
          },
        };
      }

      if (params.hasActiveMembership === 'false') {
        where.memberships = {
          none: {
            isActive: true,
            endDate: {
              gte: now,
            },
          },
        };
      }

      const students = await this.prisma.student.findMany({
        where,

        take: limit,

        orderBy: [
          {
            name: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],

        select: {
          id: true,
          name: true,
          mobile: true,

          memberships: {
            where: {
              isActive: true,
              endDate: {
                gte: now,
              },
            },

            orderBy: {
              endDate: 'desc',
            },

            take: 1,

            select: {
              id: true,

              startDate: true,

              endDate: true,

              membershipPlanId: true,

              shiftId: true,

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

              charges: {
                where: {
                  status: {
                    not: 'CANCELLED',
                  },
                },

                select: {
                  id: true,
                  type: true,
                  amountDue: true,
                  status: true,

                  allocations: {
                    select: {
                      amount: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return students.map((student) => {
        const activeMembership = student.memberships[0] ?? null;

        if (!activeMembership) {
          return {
            id: student.id,
            name: student.name,
            mobile: student.mobile,

            hasActiveMembership: false,

            paymentStatus: 'YET_TO_PAY' as const,

            account: {
              totalDue: 0,
              totalPaid: 0,
              outstanding: 0,
            },

            activeMembership: null,
          };
        }

        const account = this.calculateAccount(activeMembership.charges);

        return {
          id: student.id,
          name: student.name,
          mobile: student.mobile,

          hasActiveMembership: true,

          paymentStatus: account.status,

          account: {
            totalDue: account.totalDue,

            totalPaid: account.totalPaid,

            outstanding: account.outstanding,
          },

          activeMembership: {
            id: activeMembership.id,

            startDate: activeMembership.startDate,

            endDate: activeMembership.endDate,

            plan: {
              id: activeMembership.membershipPlan.id,

              code: activeMembership.membershipPlan.code,

              name: activeMembership.membershipPlan.name,
            },

            planId: activeMembership.membershipPlanId,

            shift: {
              id: activeMembership.shift.id,

              code: activeMembership.shift.code,

              name: activeMembership.shift.name,
            },

            shiftId: activeMembership.shiftId,
          },
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to search student options',
      );
    }
  }
}
