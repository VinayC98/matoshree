import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangeMembershipDto {
  @ApiProperty({
    description: 'Student ID',
  })
  @IsUUID()
  studentId!: string;

  @ApiProperty({
    description: 'New membership plan ID',
  })
  @IsUUID()
  membershipPlanId!: string;

  @ApiProperty({
    description: 'New shift ID',
  })
  @IsUUID()
  shiftId!: string;

  @ApiPropertyOptional({
    description:
      'New fixed seat ID. Required when changing to a fixed-seat plan.',
  })
  @IsOptional()
  @IsUUID()
  fixedSeatId!: string;

  @ApiProperty({
    description: 'Date on which the membership change takes effect.',
    example: '2026-08-10',
  })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    description: 'Amount paid at the time of changing membership.',
    example: 350,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialPaymentAmount!: number;

  @ApiPropertyOptional({
    description: 'Payment mode',
    example: 'CASH',
  })
  @IsOptional()
  @IsString()
  paymentMode!: string;
}
