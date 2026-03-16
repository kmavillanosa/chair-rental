import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query, Res, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { BookingsService } from './bookings.service';
import { BookingStatus } from './entities/booking.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { VendorsService } from '../vendors/vendors.service';
import { RocketChatService } from '../chat/rocketchat.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly service: BookingsService,
    private readonly vendorsService: VendorsService,
    private readonly rocketchatService: RocketChatService,
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
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim();
    const firstForwardedIp = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : '';
    const requestIp = firstForwardedIp || req.ip || null;
    return this.service.create(req.user.id, body, requestIp || undefined);
  }

  /**
   * Returns a short-lived Rocket.Chat auth token so the booking chat widget
   * can auto-authenticate the current user in the embedded iframe.
   *
   * Access rules:
   *  - The booking's customer may call this.
   *  - The booking's vendor (matched by vendor.userId) may call this.
   *  - Admin users may call this for moderation / dispute review.
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/chat-token')
  async getBookingChatToken(
    @Param('id') id: string,
    @Request() req,
  ) {
    const booking = await this.service.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    const user = req.user;
    const isCustomer = booking.customerId === user.id;
    const isVendor = booking.vendor?.userId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isCustomer && !isVendor && !isAdmin) {
      throw new ForbiddenException('Access denied to this booking chat');
    }

    const customerUser = booking.customer;
    const vendorUser = booking.vendor?.user;
    if (!customerUser || !vendorUser) {
      throw new NotFoundException('Booking chat participants not found');
    }

    const roomId = await this.rocketchatService.ensureBookingRoom(
      booking.id,
      customerUser.id,
      customerUser.name,
      customerUser.email,
      vendorUser.id,
      vendorUser.name,
      vendorUser.email,
    );

    if (booking.rocketchatRoomId !== roomId) {
      await this.service.setRocketchatRoomId(booking.id, roomId);
    }

    // Ensure caller is a room member to prevent "room not found/no access"
    // responses in embedded chat when permissions drift.
    await this.rocketchatService
      .ensureUserInBookingRoom(
        roomId,
        user.id,
        user.name,
        user.email,
      )
      .catch(() => {/* RC may be down — token request still succeeds */});

    const { rcUserId, authToken } =
      await this.rocketchatService.generateUserLoginToken(
        user.id,
        user.name,
        user.email,
      );

    return {
      rcUserId,
      authToken,
      roomName: `booking-${id}`,
      rocketchatUrl: this.rocketchatService.rocketchatPublicUrl,
      isAdminView: isAdmin,
    };
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
  @Post(':id/payment/remaining-balance/checkout')
  createRemainingBalanceCheckout(@Request() req, @Param('id') id: string) {
    return this.service.createRemainingBalanceCheckout(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/payment/remaining-balance/verify')
  verifyRemainingBalancePayment(
    @Request() req,
    @Param('id') id: string,
    @Body() body: VerifyPaymentDto,
  ) {
    return this.service.verifyRemainingBalancePayment(
      id,
      req.user.id,
      body.checkoutSessionId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @Post(':id/delivery-proof')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_, file, cb) => {
          const extension = extname(file.originalname) || '';
          cb(null, `delivery-proof-${Date.now()}${extension}`);
        },
      }),
    }),
  )
  uploadDeliveryProof(
    @Request() req,
    @Param('id') id: string,
    @Body('photoUrl') photoUrl: string,
    @Body('signatureUrl') signatureUrl?: string,
    @Body('note') note?: string,
    @Body('capturedAt') capturedAt?: string,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    const resolvedPhotoUrl = photoUrl || (photo ? `/uploads/${photo.filename}` : undefined);

    return this.service.uploadDeliveryProof(id, req.user.id, {
      photoUrl: resolvedPhotoUrl,
      signatureUrl,
      note,
      capturedAt,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/confirm-delivery')
  confirmDelivery(@Request() req, @Param('id') id: string) {
    return this.service.confirmDelivery(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/messages')
  listMessages(@Request() req, @Param('id') id: string) {
    return this.service.listMessages(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/messages')
  sendMessage(
    @Request() req,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.service.sendMessage(id, req.user.id, req.user.role, content);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/reviews')
  listReviews(@Request() req, @Param('id') id: string) {
    return this.service.listReviews(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/reviews')
  submitReview(
    @Request() req,
    @Param('id') id: string,
    @Body('rating') rating: number,
    @Body('comment') comment?: string,
  ) {
    return this.service.submitReview(id, req.user.id, req.user.role, rating, comment);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/documents')
  listDocuments(@Request() req, @Param('id') id: string) {
    return this.service.listDocuments(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/documents/generate')
  generateDocuments(@Request() req, @Param('id') id: string) {
    return this.service.generateDocumentsForBooking(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/documents/:documentId/download')
  async downloadDocument(
    @Request() req,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const payload = await this.service.getDocumentDownloadPayload(
      id,
      documentId,
      req.user.id,
      req.user.role,
    );

    res.setHeader('Content-Type', payload.mimeType);
    return res.download(payload.absolutePath, payload.fileName);
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
