import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  checkoutSessionId?: string;
}
