import { AuditService } from '../audit/audit.service.js';
import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service.js';
import { MembershipController } from './membership.controller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [MembershipController],
  providers: [MembershipService, PrismaService, AuditService],
})
export class MembershipModule {}
