import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';

import { AllocationService } from './allocation.service.js';

import { RunAllocationDto } from './dto/run-allocation.dto.js';
import { AssignSeatDto } from './dto/assign-seat.dto.js';
import { SeatAvailabilityDto } from './dto/seat-availability.dto.js';
import { UnassignSeatDto } from './dto/unassign-seat.dto.js';
import { SwapDailySeatDto, SwapFixedSeatDto } from './dto/swap-seat.dto.js';

import { AdminGuard } from '../auth/admin.guard.js';

@ApiTags('Seat Allocation')
@Controller('allocations')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  async getAllocations(
    @Query('date') date: string,
    @Query('shiftId') shiftId: string,
  ) {
    return this.allocationService.getAllocations(date, shiftId);
  }

  @Get('seat-map')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  async seatMap(
    @Query('date') date: string,
    @Query('shiftId') shiftId: string,
  ) {
    return this.allocationService.seatMap(date, shiftId);
  }

  @Get('available-seats')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  async availableSeats(@Query() query: SeatAvailabilityDto) {
    return this.allocationService.availableSeats(query);
  }

  @Post('run')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Seat allocation executed successfully',
  })
  async run(@Body() dto: RunAllocationDto) {
    return this.allocationService.runAllocation(dto);
  }

  @Post('assign')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Seat assigned successfully',
  })
  async assign(@Body() dto: AssignSeatDto) {
    return this.allocationService.assignSeat(dto);
  }

  @Post('unassign')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Seat unassigned successfully',
  })
  async unassign(@Body() dto: UnassignSeatDto) {
    return this.allocationService.unassignSeat(dto);
  }

  @Post('swap-daily')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Daily seats swapped successfully',
  })
  async swapDaily(@Body() dto: SwapDailySeatDto) {
    return this.allocationService.swapDailySeats(dto);
  }

  @Post('swap-fixed')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Fixed seat swapped successfully',
  })
  async swapFixed(@Body() dto: SwapFixedSeatDto) {
    return this.allocationService.swapFixedSeat(dto);
  }
}
