import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateBookingItemDto {
  @IsString()
  @MaxLength(36)
  inventoryItemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBookingDto {
  @IsString()
  @MaxLength(36)
  vendorId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingItemDto)
  items: CreateBookingItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  deliveryLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  deliveryLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryCharge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  serviceCharge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
