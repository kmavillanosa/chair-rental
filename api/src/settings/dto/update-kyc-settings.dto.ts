import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateKycSettingsDto {
  @IsOptional()
  @IsBoolean()
  vendorRegistrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requireOtpBeforeVendorRegistration?: boolean;
}
