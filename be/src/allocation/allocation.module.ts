import { Module } from '@nestjs/common';
import { AllocationService } from './allocation.service.js';
import { AllocationController } from './allocation.controller.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [AllocationController],
  providers: [AllocationService, PrismaService, AuditService],
})
export class AllocationModule {}
