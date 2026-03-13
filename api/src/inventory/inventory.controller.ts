import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { VendorsService } from '../vendors/vendors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';


@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly vendorsService: VendorsService,
  ) {}

  /**
   * Returns inventory breakdown for a vendor: total, reserved (confirmed), and available per item type for a given date (default: today)
   */
  @Get('vendor/:vendorId/breakdown')
  async getVendorInventoryBreakdown(
    @Param('vendorId') vendorId: string,
    @Request() req: any
  ) {
    // Accept ?date=YYYY-MM-DD, default to today
    const date = req.query?.date;
    return this.service.getVendorInventoryBreakdown(vendorId, date);
  }

  @Get('vendor/:vendorId')
  findByVendor(@Param('vendorId') vendorId: string) {
    return this.service.findByVendor(vendorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Post()
  async create(@Request() req, @Body() body: any) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.service.create({ ...body, vendorId: vendor.id });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
