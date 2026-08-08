import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class AssignSeatDto {
  @ApiProperty({ example: '2025-01-23' })
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsUUID()
  shiftId: string;

  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  seatId: string;
}
