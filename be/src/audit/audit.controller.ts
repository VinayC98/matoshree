import { Controller, Get, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';

@ApiTags('Audit Logs')
@Controller('audit-logs')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('action') action?: string,
    @Query('entity') entity?: string,
  ) {
    const skip = (+page - 1) * +limit;

    const where: any = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: +limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      page: +page,
      limit: +limit,
      total,
      data,
    };
  }
}
