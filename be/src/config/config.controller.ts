import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from './config.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';

@ApiBearerAuth()
@UseGuards(AdminGuard)
@ApiTags('Config')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * GET /config/membership-plans
   */
  @Get('membership-plans')
  @ApiOkResponse({ description: 'List of active membership plans' })
  async getPlans() {
    return this.configService.getMembershipPlans();
  }

  /**
   * GET /config/shifts
   */
  @Get('shifts')
  @ApiOkResponse({ description: 'List of active shifts' })
  async getShifts() {
    return this.configService.getShifts();
  }

  /**
   * GET /config/pricing/preview
   * ?planId=UUID&shiftId=UUID
   */
  @Get('pricing/preview')
  @ApiOkResponse({ description: 'Pricing preview for plan and shift' })
  async getPricingPreview(@Query('planId') planId: string, @Query('shiftId') shiftId: string) {
    return this.configService.getPricingPreview(planId, shiftId);
  }
}
