import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post()
  @ApiCreatedResponse({ description: 'Payment recorded successfully' })
  async create(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto);
  }

  @Get()
  getPayments(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('paymentType') paymentType?: string,
  ) {
    return this.paymentService.getPayments({
      page: Number(page),
      limit: Number(limit),
      paymentType,
    });
  }
}
