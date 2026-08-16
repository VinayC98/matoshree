import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StudentModule } from './student/student.module.js';

import { MembershipModule } from './membership/membership.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { ConfigModules } from './config/config.module.js';
import { AllocationModule } from './allocation/allocation.module.js';

import { CronModule } from './cron/cron.module.js';
import { JwtModule } from '@nestjs/jwt';

import { JwtStrategy } from './auth/jwt.strategy.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PassportModule } from '@nestjs/passport';

import { AuditModule } from './audit/audit.module.js';
import { PrismaService } from './prisma.service.js';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1d',
        },
      }),
    }),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    AdminModule,
    StudentModule,
    MembershipModule,
    PaymentModule,
    ConfigModules,
    AllocationModule,
    CronModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, JwtStrategy],
})
export class AppModule {}
