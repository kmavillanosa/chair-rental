import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UpdateKycSettingsDto } from './dto/update-kyc-settings.dto';
import { UpdateFeatureFlagsSettingsDto } from './dto/update-feature-flags-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('kyc')
  getKycSettings() {
    return this.settingsService.getKycSettings();
  }

  @Get('feature-flags')
  getFeatureFlagsSettings() {
    return this.settingsService.getFeatureFlagsSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch('kyc')
  updateKycSettings(@Body() body: UpdateKycSettingsDto) {
    return this.settingsService.updateKycSettings(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch('feature-flags')
  updateFeatureFlagsSettings(@Body() body: UpdateFeatureFlagsSettingsDto) {
    return this.settingsService.updateFeatureFlagsSettings(body);
  }
}
