import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class SeatAvailabilityDto {
  @ApiPropertyOptional({
    example: '2025-01-23',
    description: 'Defaults to today',
  })
  @IsOptional()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsUUID()
  shiftId!: string;
}
