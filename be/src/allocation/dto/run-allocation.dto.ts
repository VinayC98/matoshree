import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class RunAllocationDto {
  @ApiProperty({ example: '2025-01-23' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Shift ID' })
  @IsUUID()
  shiftId: string;
}
