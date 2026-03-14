import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { BookingStatus } from './entities/booking.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { VendorsService } from '../vendors/vendors.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly service: BookingsService,
    private readonly vendorsService: VendorsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my')
  getMyBookings(@Request() req) {
    return this.service.findByCustomer(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Get('vendor')
  async getVendorBookings(@Request() req) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.service.findByVendor(vendor.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('vendor/:vendorId/availability')
  async checkAvailability(
    @Param('vendorId') vendorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.checkAvailability(vendorId, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  async create(@Request() req, @Body() body: CreateBookingDto) {
    return this.service.create(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/payment/checkout')
  createPaymentCheckout(@Request() req, @Param('id') id: string) {
    return this.service.createOrRefreshCheckout(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/payment/verify')
  verifyPayment(
    @Request() req,
    @Param('id') id: string,
    @Body() body: VerifyPaymentDto,
  ) {
    return this.service.verifyPayMongoCheckout(
      id,
      req.user.id,
      body.checkoutSessionId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/cancellation-preview')
  getCancellationPreview(@Request() req, @Param('id') id: string) {
    return this.service.getCancellationPreview(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id/status')
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() body: UpdateBookingStatusDto,
  ) {
    return this.service.updateStatus(
      id,
      body.status as BookingStatus,
      req.user.id,
      req.user.role,
    );
  }
}
