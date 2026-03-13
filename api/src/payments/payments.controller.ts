import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { VendorsService } from '../vendors/vendors.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly vendorsService: VendorsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get()
  findAll() { return this.service.findAllPayments(); }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('vendor/my')
  async getMyPayments(@Request() req) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.service.findByVendor(vendor.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post()
  createPayment(@Body() body: any) { return this.service.createPayment(body); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/paid')
  markPaid(@Param('id') id: string, @Body('transactionRef') ref?: string) {
    return this.service.markPaid(id, ref);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/overdue')
  markOverdue(@Param('id') id: string) { return this.service.markOverdue(id); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Get('delivery-rates')
  async getDeliveryRates(@Request() req) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.service.getDeliveryRates(vendor.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('delivery-rates/vendor/:vendorId')
  getVendorDeliveryRates(@Param('vendorId') vendorId: string) {
    return this.service.getDeliveryRates(vendorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Post('delivery-rates')
  async addDeliveryRate(@Request() req, @Body() body: any) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.service.upsertDeliveryRate(vendor.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Patch('delivery-rates/:id')
  async updateDeliveryRate(@Request() req, @Param('id') id: string, @Body() body: any) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.service.updateDeliveryRate(vendor.id, id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Delete('delivery-rates/:id')
  async deleteDeliveryRate(@Request() req, @Param('id') id: string) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.service.deleteDeliveryRate(vendor.id, id);
  }
}
