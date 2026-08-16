import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export enum PaymentType {
  REGISTRATION = 'REGISTRATION',
  MONTHLY = 'MONTHLY',
  ADVANCE = 'ADVANCE',
  PARTIAL = 'PARTIAL',
}

export class CreatePaymentDto {
  @IsUUID()
  membershipId!: string;

  @IsEnum(['CASH', 'UPI', 'CARD'])
  paymentMode!: 'CASH' | 'UPI' | 'CARD';

  /**
   * NEW — explicit amount
   * Backend validates correctness
   */
  @IsInt()
  @Min(1)
  amount!: number;

  /**
   * NEW — intent of payment
   */
  @IsEnum(PaymentType)
  paymentType!: PaymentType;

  /**
   * BACKWARD COMPATIBILITY
   * Old clients still sending this
   */
  @IsOptional()
  @IsBoolean()
  isRegistrationFee!: boolean;

  // NEW (optional)
  @IsOptional()
  extendMembership?: boolean;
  @IsOptional()
  extendMonths!: number;
}
