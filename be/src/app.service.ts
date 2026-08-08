import { Injectable } from '@nestjs/common';

import { User, Prisma } from './generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}
  getHello(): string {
    return 'Hello World!';
  }

  async user() {
    try {
      return this.prisma.user.findMany();
    } catch (e) {
      console.error(e);
    }
  }
}
