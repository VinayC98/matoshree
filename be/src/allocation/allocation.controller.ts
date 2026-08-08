import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AllocationService } from './allocation.service.js';
import { RunAllocationDto } from './dto/run-allocation.dto.js';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AssignSeatDto } from './dto/assign-seat.dto.js';
import { SeatAvailabilityDto } from './dto/seat-availability.dto.js';
import { UnassignSeatDto } from './dto/unassign-seat.dto.js';
import { SwapDailySeatDto, SwapFixedSeatDto } from './dto/swap-seat.dto.js';

@ApiTags('Seat Allocation')
@Controller('allocations')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  /**
   * POST /allocations/run
   */

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post('run')
  @ApiCreatedResponse({ description: 'Seat allocation executed' })
  async run(@Body() dto: RunAllocationDto) {
    return this.allocationService.runAllocation(dto);
  }

  // View who sits where (list)
  @Get()
  getAllocations(@Query('date') date: string, @Query('shiftId') shiftId: string) {
    return this.allocationService.getAllocations(date, shiftId);
  }

  /**
   * GET /allocations/seat-map?date=&shiftId=
   */
  @Get('seat-map')
  seatMap(@Query('date') date: string, @Query('shiftId') shiftId: string) {
    return this.allocationService.seatMap(date, shiftId);
  }

  @Post('assign')
  @UseGuards(AdminGuard)
  @ApiBearerAuth('jwt-auth')
  assign(@Body() dto: AssignSeatDto) {
    return this.allocationService.assignSeat(dto);
  }

  @Get('available-seats')
  @UseGuards(AdminGuard)
  @ApiBearerAuth('jwt-auth')
  availableSeats(@Query() query: SeatAvailabilityDto) {
    return this.allocationService.availableSeats(query);
  }

  @Post('unassign')
  @UseGuards(AdminGuard)
  @ApiBearerAuth('jwt-auth')
  unassign(@Body() dto: UnassignSeatDto) {
    return this.allocationService.unassignSeat(dto);
  }

  @Post('swap-daily')
  @UseGuards(AdminGuard)
  @ApiBearerAuth('jwt-auth')
  swap(@Body() dto: SwapDailySeatDto) {
    return this.allocationService.swapDailySeats(dto);
  }

  @Post('swap-fixed')
  @UseGuards(AdminGuard)
  @ApiBearerAuth('jwt-auth')
  swapFixed(@Body() dto: SwapFixedSeatDto) {
    return this.allocationService.swapFixedSeat(dto);
  }
}
