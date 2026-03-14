import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionRef?: string;
}
