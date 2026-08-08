import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new student
   */
  async createStudent(dto: CreateStudentDto) {
    try {
      // Check for duplicate mobile number
      const existing = await this.prisma.student.findUnique({
        where: { mobile: dto.mobile },
      });

      if (existing) {
        throw new ConflictException('Student with this mobile already exists');
      }

      const addStudent = await this.prisma.student.create({
        data: dto,
      });
      /* AUDIT LOG (✅ NOW REACHABLE) */
      await this.auditService.log({
        action: 'CREATE_STUDENT',
        entity: 'Student',
        entityId: addStudent.id,
        actorId: '',
        actorName: 'Admin',
        actorRole: 'ADMIN',
        description: `Sudent Created Successfully.`,
        meta: {
          StudentInfo: addStudent,
        },
      });
      return addStudent;
    } catch (error) {
      // Re-throw known HTTP errors
      if (error.status) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create student');
    }
  }

  /**
   * Get all students with active memberships
   */
  async getAllStudents() {
    try {
      return await this.prisma.student.findMany({
        include: {
          memberships: {
            where: { isActive: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  /**
   * Get single student by ID
   */
  async getStudentById(id: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { id },
        include: {
          memberships: true,
          payments: true,
        },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      return student;
    } catch (error) {
      if (error.status) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch student');
    }
  }

  async getLatestStudents(page, limit) {
    try {
      const skip = (+page - 1) * +limit;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const students = await this.prisma.student.findMany({
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: {
            where: { isActive: true },
            include: {
              membershipPlan: {
                select: { name: true, code: true },
              },
              shift: {
                select: { name: true, code: true },
              },
              fixedSeat: {
                include: {
                  lab: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      console.log(JSON.stringify(students, null, 2), 'askdhaksjhd');

      return await Promise.all(
        students.map(async (student) => {
          const membership = student.memberships[0] ?? null;

          let seatLabel: string | null = null;

          // 1️⃣ FIXED SEAT (highest priority)
          if (membership?.fixedSeat) {
            seatLabel = `${membership.fixedSeat.lab.name} - Seat ${membership.fixedSeat.seatNumber}`;
          }
          // 2️⃣ DAILY SEAT (today)
          else {
            const seatAlloc = await this.prisma.dailySeatAllocation.findFirst({
              where: {
                studentId: student.id,
                date: today,
              },
              include: {
                seat: {
                  include: {
                    lab: { select: { name: true } },
                  },
                },
              },
            });

            if (seatAlloc) {
              seatLabel = `${seatAlloc.seat.lab.name} - Seat ${seatAlloc.seat.seatNumber}`;
            }
          }

          return {
            id: student.id,
            name: student.name,
            mobile: student.mobile,
            createdAt: student.createdAt.toISOString(),

            activeMembership: membership
              ? {
                  planName: membership.membershipPlan.name,
                  planCode: membership.membershipPlan.code,
                  shiftName: membership.shift.name,
                  shiftCode: membership.shift.code,
                  startDate: membership.startDate.toISOString(),
                  endDate: membership.endDate.toISOString(),
                }
              : null,

            seat: seatLabel, // ✅ FIXED + DAILY
          };
        }),
      );
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to fetch latest students');
    }
  }

  async getStudentDetails(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
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

    const memberships = await this.prisma.membership.findMany({
      where: { studentId },
      orderBy: { startDate: 'desc' },
      include: {
        membershipPlan: {
          select: { id: true, name: true, code: true },
        },
        shift: {
          select: { id: true, name: true, code: true },
        },
        fixedSeat: {
          include: {
            lab: { select: { id: true, name: true } },
          },
        },
      },
    });

    const payments = await this.prisma.payment.findMany({
      where: { studentId },
      orderBy: { paidOn: 'desc' },
    });

    const allocations = await this.prisma.dailySeatAllocation.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      include: {
        shift: { select: { name: true } },
        seat: {
          include: {
            lab: { select: { name: true } },
          },
        },
      },
    });

    return {
      student,
      memberships,
      payments,
      allocations,
    };
  }
}
