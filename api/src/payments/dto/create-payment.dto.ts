import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentStatus } from '../entities/vendor-payment.entity';

export class CreatePaymentDto {
  @IsString()
  @MaxLength(36)
  vendorId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  period?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionRef?: string;
}
