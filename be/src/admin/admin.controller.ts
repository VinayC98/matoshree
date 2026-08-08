import { UseGuards, Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { AdminService } from './admin.service.js';

@ApiBearerAuth()
@UseGuards(AdminGuard)
@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('debug')
  @UseGuards(AdminGuard)
  debug(@Req() req) {
    return req.user;
  }

  // @Get('audit-logs')
  // @UseGuards(AdminGuard)
  // @ApiBearerAuth('jwt-auth')
  // getLogs() {
  //   return this.adminService.getAuditLogs();
  // }
}
