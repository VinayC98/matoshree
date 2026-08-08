import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller.js';
import { ConfigService } from './config.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [ConfigController],
  providers: [ConfigService, PrismaService],
})
export class ConfigModules {}
