import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get active membership plans
   * Used by frontend dropdown
   */
  async getMembershipPlans() {
    return this.prisma.membershipPlan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        requiresFixedSeat: true,
        isSeatDailyAssigned: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get active shifts
   * Used by frontend dropdown
   */
  async getShifts() {
    return this.prisma.shift.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Preview pricing for selected plan + shift
   * Frontend uses this before submitting membership
   */
  async getPricingPreview(planId: string, shiftId: string) {
    const pricing = await this.prisma.pricing.findFirst({
      where: {
        membershipPlanId: planId,
        shiftId: shiftId,
        isActive: true,
      },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        monthlyFee: true,
        registrationFee: true,
        billingCycleDays: true,
      },
    });

    if (!pricing) {
      throw new NotFoundException(
        'Pricing not found for selected plan and shift',
      );
    }

    return pricing;
  }
}
