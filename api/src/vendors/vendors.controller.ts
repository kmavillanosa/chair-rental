import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
    @Query('itemTypeIds') itemTypeIds?: string,
    @Query('helpersNeeded') helpersNeeded = '0',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedItemTypeIds = (itemTypeIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.vendorsService.findNearby(
      Number(lat),
      Number(lng),
      Number(radius),
      parsedItemTypeIds,
      Number(helpersNeeded),
      startDate,
      endDate,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('otp/request')
  requestPhoneOtp(@Request() req, @Body() body: any) {
    const headerFingerprint = String(req.headers['x-device-fingerprint'] || '').trim();
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim();
    const requestIp = forwardedFor || req.ip || null;

    return this.vendorsService.requestPhoneOtp(
      req.user.id,
      body.email,
      body.deviceFingerprint || headerFingerprint || undefined,
      requestIp || undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('otp/verify')
  verifyPhoneOtp(@Request() req, @Body() body: any) {
    return this.vendorsService.verifyPhoneOtp(
      req.user.id,
      body.email,
      body.code,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('register')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'governmentIdFile', maxCount: 1 },
        { name: 'selfieFile', maxCount: 1 },
        { name: 'mayorsPermitFile', maxCount: 1 },
        { name: 'barangayPermitFile', maxCount: 1 },
        { name: 'logoFile', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: process.env.UPLOAD_DIR || './uploads',
          filename: (_, file, cb) => {
            const extension = extname(file.originalname) || '';
            cb(null, `kyc-register-${file.fieldname}-${Date.now()}${extension}`);
          },
        }),
      },
    ),
  )
  registerVendor(
    @Request() req,
    @Body() body: any,
    @UploadedFiles()
    files?: {
      governmentIdFile?: Express.Multer.File[];
      selfieFile?: Express.Multer.File[];
      mayorsPermitFile?: Express.Multer.File[];
      barangayPermitFile?: Express.Multer.File[];
      logoFile?: Express.Multer.File[];
    },
  ) {
    const headerFingerprint = String(req.headers['x-device-fingerprint'] || '').trim();

    const governmentIdFile = files?.governmentIdFile?.[0];
    const selfieFile = files?.selfieFile?.[0];
    const mayorsPermitFile = files?.mayorsPermitFile?.[0];
    const barangayPermitFile = files?.barangayPermitFile?.[0];
    const logoFile = files?.logoFile?.[0];

    return this.vendorsService.submitRegistration(req.user.id, {
      ...body,
      governmentIdUrl:
        body.governmentIdUrl ||
        body.kycDocumentUrl ||
        (governmentIdFile ? `/uploads/${governmentIdFile.filename}` : undefined),
      selfieUrl:
        body.selfieUrl ||
        body.selfieVerificationUrl ||
        (selfieFile ? `/uploads/${selfieFile.filename}` : undefined),
      mayorsPermitUrl:
        body.mayorsPermitUrl ||
        (mayorsPermitFile ? `/uploads/${mayorsPermitFile.filename}` : undefined),
      barangayPermitUrl:
        body.barangayPermitUrl ||
        (barangayPermitFile ? `/uploads/${barangayPermitFile.filename}` : undefined),
      logoUrl:
        body.logoUrl ||
        (logoFile ? `/uploads/${logoFile.filename}` : undefined),
      deviceFingerprint: body.deviceFingerprint || headerFingerprint || undefined,
    });
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
  async updateMyVendor(@Request() req, @Body() body: any) {
    const vendor = await this.vendorsService.findByUserId(req.user.id);
    return this.vendorsService.update(vendor.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my/kyc')
  getMyKycSubmission(@Request() req) {
    return this.vendorsService.getMyKycSubmission(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my/documents')
  getMyDocuments(@Request() req) {
    return this.vendorsService.listMyVendorDocuments(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('my/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_, file, cb) => {
          const extension = extname(file.originalname) || '';
          cb(null, `kyc-${Date.now()}${extension}`);
        },
      }),
    }),
  )
  uploadMyDocument(
    @Request() req,
    @Body('documentType') documentType: string,
    @Body('fileUrl') fileUrl: string,
    @Body('metadata') metadataRaw?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let metadata: Record<string, unknown> | undefined;
    if (metadataRaw) {
      try {
        metadata = JSON.parse(metadataRaw);
      } catch {
        metadata = { raw: metadataRaw };
      }
    }

    const resolvedFileUrl =
      fileUrl || (file ? `/uploads/${file.filename}` : undefined);

    return this.vendorsService.uploadVendorDocument(
      req.user.id,
      documentType,
      resolvedFileUrl,
      metadata,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my/items')
  listMyVendorItems(@Request() req) {
    return this.vendorsService.listMyVendorItems(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('my/items')
  createVendorItem(@Request() req, @Body() body: any) {
    return this.vendorsService.createVendorItem(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('my/items/:itemId/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_, file, cb) => {
          const extension = extname(file.originalname) || '';
          cb(null, `item-proof-${Date.now()}${extension}`);
        },
      }),
    }),
  )
  uploadVendorItemPhoto(
    @Request() req,
    @Param('itemId') itemId: string,
    @Body('photoType') photoType: string,
    @Body('fileUrl') fileUrl: string,
    @Body('metadata') metadataRaw?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let metadata: Record<string, unknown> | undefined;
    if (metadataRaw) {
      try {
        metadata = JSON.parse(metadataRaw);
      } catch {
        metadata = { raw: metadataRaw };
      }
    }

    const resolvedFileUrl =
      fileUrl || (file ? `/uploads/${file.filename}` : undefined);

    return this.vendorsService.uploadVendorItemPhoto(
      req.user.id,
      itemId,
      photoType,
      resolvedFileUrl,
      metadata,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('requests')
  findRegistrationRequests(@Query('status') status?: string) {
    return this.vendorsService.findRegistrationRequests(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get(':id/kyc')
  getKycSubmission(@Param('id') id: string) {
    return this.vendorsService.getKycSubmission(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get(':id/documents')
  listVendorDocuments(@Param('id') id: string) {
    return this.vendorsService.listVendorDocuments(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get(':id/items')
  listVendorItems(@Param('id') id: string) {
    return this.vendorsService.listVendorItems(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/review')
  reviewRegistration(
    @Request() req,
    @Param('id') id: string,
    @Body('decision') decision: 'approve' | 'reject',
    @Body('notes') notes?: string,
  ) {
    return this.vendorsService.reviewRegistration(
      id,
      decision,
      notes,
      req.user.id,
    );
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/verify')
  verify(
    @Request() req,
    @Param('id') id: string,
    @Body('isVerified') isVerified: boolean,
  ) {
    return this.vendorsService.verify(id, isVerified, req.user.id);
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
  setActive(
    @Request() req,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Body('reason') reason?: string,
  ) {
    return this.vendorsService.setActive(id, isActive, reason, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/flag-suspicious')
  flagSuspicious(
    @Request() req,
    @Param('id') id: string,
    @Body('flagged') flagged = true,
    @Body('reason') reason?: string,
  ) {
    return this.vendorsService.flagSuspicious(id, Boolean(flagged), reason, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/suspend')
  suspend(
    @Request() req,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('suspendedUntil') suspendedUntil?: string,
  ) {
    return this.vendorsService.suspend(id, reason, suspendedUntil, req.user.id);
  }
}
