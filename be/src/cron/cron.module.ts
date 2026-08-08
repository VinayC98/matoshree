import { Module } from '@nestjs/common';
import { MembershipExpiryService } from './membership-expiry.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  providers: [MembershipExpiryService, PrismaService],
})
export class CronModule {}
