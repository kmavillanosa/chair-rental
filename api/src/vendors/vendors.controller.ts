import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius = '50',
  ) {
    return this.vendorsService.findNearby(Number(lat), Number(lng), Number(radius));
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.vendorsService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post()
  create(@Body() body: any) {
    return this.vendorsService.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my')
  getMyVendor(@Request() req) {
    return this.vendorsService.findByUserId(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('my')
  updateMyVendor(@Request() req, @Body() body: any) {
    return this.vendorsService.findByUserId(req.user.id).then((v) =>
      this.vendorsService.update(v.id, body),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/verify')
  verify(@Param('id') id: string, @Body('isVerified') isVerified: boolean) {
    return this.vendorsService.verify(id, isVerified);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/warn')
  warn(@Param('id') id: string) {
    return this.vendorsService.warn(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.vendorsService.setActive(id, isActive);
  }
}
