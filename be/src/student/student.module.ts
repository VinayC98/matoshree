import { Module } from '@nestjs/common';
import { StudentService } from './student.service.js';
import { StudentController } from './student.controller.js';

import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  providers: [StudentService, PrismaService, AuditService],
  controllers: [StudentController],
})
export class StudentModule {}
