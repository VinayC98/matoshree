import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RenewMembershipDto {
  @ApiProperty({
    description: 'Student ID',
  })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({
    description: 'Amount paid during renewal',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentAmount!: number;

  @ApiPropertyOptional({
    description: 'Payment mode',
    example: 'CASH',
  })
  @IsOptional()
  @IsString()
  paymentMode!: string;
}
