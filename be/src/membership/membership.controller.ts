import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { MembershipService } from './membership.service.js';

import { CreateMembershipDto } from './dto/create-membership.dto.js';
import { RenewMembershipDto } from './dto/renew-membership.dto.js';
import { ChangeMembershipDto } from './dto/change-membership.dto.js';

import { AdminGuard } from '../auth/admin.guard.js';

@ApiTags('Memberships')
@Controller('memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Membership created successfully',
  })
  async create(@Body() dto: CreateMembershipDto) {
    return this.membershipService.createMembership(dto);
  }

  @Post('renew')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Membership renewed successfully',
  })
  async renew(@Body() dto: RenewMembershipDto) {
    return this.membershipService.renewMembership(dto);
  }

  @Post('change')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiCreatedResponse({
    description: 'Membership changed successfully',
  })
  async change(@Body() dto: ChangeMembershipDto) {
    return this.membershipService.changeMembership(dto);
  }

  @Get(':membershipId/account')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOkResponse({
    description: 'Membership account summary',
  })
  async getAccount(@Param('membershipId') membershipId: string) {
    return this.membershipService.getMembershipAccount(membershipId);
  }
}
