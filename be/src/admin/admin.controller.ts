import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { AdminGuard } from '../auth/admin.guard.js';
import { AdminService } from './admin.service.js';

interface AuthenticatedUser {
  sub: string;
  email: string;
}

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiBearerAuth()
@UseGuards(AdminGuard)
@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('debug')
  debug(@Req() req: AuthenticatedRequest): AuthenticatedUser {
    return req.user;
  }
}
