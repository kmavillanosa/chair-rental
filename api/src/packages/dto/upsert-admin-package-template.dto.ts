import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpsertAdminPackageTemplateItemDto {
  @IsUUID()
  itemTypeId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  requiredQty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  suggestedUnitPrice?: number | null;
}

export class UpsertAdminPackageTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertAdminPackageTemplateItemDto)
  items: UpsertAdminPackageTemplateItemDto[];
}