import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class CreateMembershipDto {
  @ApiProperty({ description: 'Student ID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Membership Plan ID' })
  @IsUUID()
  membershipPlanId: string;

  @ApiProperty({ description: 'Shift ID' })
  @IsUUID()
  shiftId: string;

  @ApiProperty({
    description: 'Fixed Seat ID (required only for fixed seat plans)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  fixedSeatId?: string;

  @ApiProperty({
    description: 'Membership start date (ISO format)',
    example: '2025-01-01',
  })
  @IsDateString()
  startDate: string;
}
