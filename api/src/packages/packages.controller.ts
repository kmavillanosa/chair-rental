import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { PackagesService } from './packages.service';
import { UpsertAdminPackageTemplateDto } from './dto/upsert-admin-package-template.dto';

@ApiTags('packages')
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('admin/templates')
  listAdminTemplates(@Query('includeInactive') includeInactive?: string) {
    const allowInactive =
      includeInactive === undefined
        ? true
        : ['1', 'true', 'yes'].includes(String(includeInactive).toLowerCase());
    return this.packagesService.listAdminTemplates(allowInactive);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post('admin/templates')
  createAdminTemplate(@Body() body: UpsertAdminPackageTemplateDto) {
    return this.packagesService.createAdminTemplate(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch('admin/templates/:id')
  updateAdminTemplate(
    @Param('id') id: string,
    @Body() body: UpsertAdminPackageTemplateDto,
  ) {
    return this.packagesService.updateAdminTemplate(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Delete('admin/templates/:id')
  removeAdminTemplate(@Param('id') id: string) {
    return this.packagesService.removeAdminTemplate(id);
  }
}