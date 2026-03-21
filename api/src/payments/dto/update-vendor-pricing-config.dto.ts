import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeliveryPricingTierDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minDistanceKm: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxDistanceKm: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceAmount: number;
}

export class HelperPricingTierDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  helperCount: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceAmount: number;
}

export class UpdateVendorPricingConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryFreeRadiusKm?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  deliveryPerKmEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryPerKmRate?: number | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  helpersEnabled?: boolean;

  @IsOptional()
  @IsEnum(['tiered', 'fixed', 'hourly'])
  helpersPricingMode?: 'tiered' | 'fixed' | 'hourly';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  helpersFixedPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  helpersHourlyRate?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  helpersMaxCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  waitingFeePerHour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  nightSurcharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryPricingTierDto)
  deliveryTiers?: DeliveryPricingTierDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HelperPricingTierDto)
  helperTiers?: HelperPricingTierDto[];
}
