import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { DisputesService } from './disputes.service';
import { BookingDisputeOutcome, BookingDisputeStatus } from './entities/booking-dispute.entity';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('admin')
  listAdmin(@Query('status') status?: BookingDisputeStatus) {
    return this.disputesService.listAdmin(status);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('booking/:bookingId')
  listForBooking(@Request() req, @Param('bookingId') bookingId: string) {
    return this.disputesService.listForBooking(bookingId, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('booking/:bookingId')
  openDispute(
    @Request() req,
    @Param('bookingId') bookingId: string,
    @Body('reason') reason: string,
  ) {
    return this.disputesService.openDispute(
      bookingId,
      req.user.id,
      req.user.role,
      reason,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_, file, cb) => {
          const extension = extname(file.originalname) || '';
          cb(null, `dispute-evidence-${Date.now()}${extension}`);
        },
      }),
    }),
  )
  addEvidence(
    @Request() req,
    @Param('id') disputeId: string,
    @Body('fileUrl') fileUrl: string,
    @Body('note') note?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const resolvedFileUrl = fileUrl || (file ? `/uploads/${file.filename}` : undefined);

    return this.disputesService.addEvidence(
      disputeId,
      req.user.id,
      req.user.role,
      resolvedFileUrl,
      note,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/review')
  reviewDispute(
    @Request() req,
    @Param('id') disputeId: string,
    @Body('outcome') outcome: BookingDisputeOutcome,
    @Body('resolutionNote') resolutionNote?: string,
    @Body('refundAmount') refundAmount?: number,
  ) {
    return this.disputesService.reviewDispute(
      disputeId,
      req.user.id,
      outcome,
      resolutionNote,
      refundAmount,
    );
  }
}