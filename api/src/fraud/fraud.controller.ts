import { Body, Controller, Get, Patch, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FraudService } from './fraud.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FraudAlertStatus, FraudAlertType } from './entities/fraud-alert.entity';

@ApiTags('fraud')
@Controller('fraud')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('alerts')
  listAlerts(
    @Query('status') status?: FraudAlertStatus,
    @Query('type') type?: FraudAlertType,
  ) {
    return this.fraudService.listAlerts(status, type);
  }

  @Get('summary')
  getSummary() {
    return this.fraudService.getSummary();
  }

  @Patch('alerts/:id/review')
  reviewAlert(
    @Request() req,
    @Param('id') id: string,
    @Body('status') status: FraudAlertStatus,
    @Body('resolutionNote') resolutionNote?: string,
  ) {
    return this.fraudService.reviewAlert(id, status, req.user.id, resolutionNote);
  }
}