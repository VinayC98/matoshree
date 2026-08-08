import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipService } from './membership.service.js';
import { CreateMembershipDto } from './dto/create-membership.dto.js';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';

@ApiTags('Memberships')
@Controller('memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Post()
  @ApiCreatedResponse({ description: 'Membership created successfully' })
  async create(@Body() dto: CreateMembershipDto) {
    return this.membershipService.createMembership(dto);
  }
}
