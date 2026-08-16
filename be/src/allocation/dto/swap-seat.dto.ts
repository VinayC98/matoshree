import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class SwapDailySeatDto {
  @ApiProperty({ example: '2025-01-23' })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsUUID()
  shiftId!: string;

  @ApiProperty()
  @IsUUID()
  seatIdA!: string;

  @ApiProperty()
  @IsUUID()
  seatIdB!: string;
}

export class SwapFixedSeatDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  newSeatId!: string;
}
