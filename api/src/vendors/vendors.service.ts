import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { In, MoreThan, Repository } from 'typeorm';
import {
  BusinessRegistrationType,
  Vendor,
  VendorKycStatus,
  VendorRegistrationStatus,
  VendorType,
  VendorVerificationStatus,
} from './entities/vendor.entity';
import {
  VendorDocument,
  VendorDocumentStatus,
  VendorDocumentType,
} from './entities/vendor-document.entity';
import {
  VendorVerificationAction,
  VendorVerificationStatusEntry,
} from './entities/vendor-verification-status.entity';
import {
  VendorItem,
  VendorItemVerificationStatus,
} from './entities/vendor-item.entity';
import {
  VendorItemPhoto,
  VendorItemPhotoType,
} from './entities/vendor-item-photo.entity';
import { VendorPhoneOtpChallenge } from './entities/vendor-phone-otp-challenge.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { DeliveryRate } from '../payments/entities/delivery-rate.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { EmailService } from '../common/email.service';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);
  private readonly emailOtpChannel = '__email__';

  constructor(
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
    @InjectRepository(VendorDocument)
    private readonly documentsRepo: Repository<VendorDocument>,
    @InjectRepository(VendorVerificationStatusEntry)
    private readonly verificationStatusRepo: Repository<VendorVerificationStatusEntry>,
    @InjectRepository(VendorItem)
    private readonly vendorItemsRepo: Repository<VendorItem>,
    @InjectRepository(VendorItemPhoto)
    private readonly vendorItemPhotosRepo: Repository<VendorItemPhoto>,
    @InjectRepository(VendorPhoneOtpChallenge)
    private readonly otpChallengesRepo: Repository<VendorPhoneOtpChallenge>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(DeliveryRate)
    private readonly deliveryRatesRepo: Repository<DeliveryRate>,
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  async findAll() {
    const vendors = await this.vendorsRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return vendors.map((vendor) => this.withVerificationBadge(vendor));
  }

  async findById(id: string, withKycDetails = false) {
    const vendor = await this.findByIdRaw(id, withKycDetails);
    return this.withVerificationBadge(vendor);
  }

  async findBySlug(slug: string) {
    const vendor = await this.vendorsRepo.findOne({
      where: { slug },
      relations: ['user'],
    });
    return this.withVerificationBadge(vendor);
  }

  async findByUserId(userId: string, withKycDetails = false) {
    const vendor = await this.findByUserIdRaw(userId, withKycDetails);
    return this.withVerificationBadge(vendor);
  }

  async create(data: Partial<Vendor>) {
    const normalizedVendorType = this.normalizeVendorType(data.vendorType);
    const verificationStatus =
      this.normalizeVerificationStatus(data.verificationStatus) ||
      (data.isVerified
        ? this.mapVendorTypeToVerifiedStatus(normalizedVendorType)
        : VendorVerificationStatus.PENDING_VERIFICATION);

    const vendorData: Partial<Vendor> = {
      ...data,
      vendorType: normalizedVendorType,
      businessRegistrationType: this.normalizeBusinessRegistrationType(
        data.businessRegistrationType,
      ),
      businessRegistrationNumber: this.normalizeIdentifier(
        data.businessRegistrationNumber,
      ),
      birTin: this.normalizeTin(data.birTin),
      ownerFullName: this.normalizeText(data.ownerFullName),
      governmentIdNumber: this.normalizeIdentifier(data.governmentIdNumber),
      phone: this.normalizePhone(data.phone),
      socialMediaLink: this.normalizeText(data.socialMediaLink),
      registrationStatus:
        data.registrationStatus || VendorRegistrationStatus.APPROVED,
      kycStatus: data.kycStatus || VendorKycStatus.APPROVED,
      verificationStatus,
      verificationBadge: this.getVerificationBadgeLabel(verificationStatus),
      isVerified: data.isVerified ?? true,
      isActive: data.isActive ?? true,
      duplicateRiskScore: Number(data.duplicateRiskScore || 0),
    };

    if (!vendorData.businessName && vendorData.ownerFullName) {
      vendorData.businessName = `${vendorData.ownerFullName} Rentals`;
    }

    if (!vendorData.slug && vendorData.businessName) {
      vendorData.slug = await this.ensureSlugAvailable(vendorData.businessName);
    }

    const vendor = this.vendorsRepo.create(vendorData);
    const saved = await this.vendorsRepo.save(vendor);
    return this.findById(saved.id, true);
  }

  async requestPhoneOtp(
    userId: string,
    emailInput: string,
    deviceFingerprintInput?: string,
    requestIp?: string,
  ) {
    const email = await this.resolveOtpEmail(userId, emailInput);

    const now = new Date();
    const latest = await this.otpChallengesRepo.findOne({
      where: { userId, phone: this.emailOtpChannel },
      order: { createdAt: 'DESC' },
    });

    if (latest) {
      const secondsSinceLatest =
        (now.getTime() - new Date(latest.createdAt).getTime()) / 1000;
      if (secondsSinceLatest < 30) {
        throw new BadRequestException('Please wait before requesting a new OTP');
      }
    }

    const otpCode = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const challenge = this.otpChallengesRepo.create({
      userId,
      phone: this.emailOtpChannel,
      otpHash: this.hashOtp(email, otpCode),
      expiresAt,
      requestIp: requestIp || null,
      deviceFingerprintHash: this.hashValue(deviceFingerprintInput || null),
    });
    await this.otpChallengesRepo.save(challenge);

    try {
      await this.emailService.sendVendorOtpEmail(email, otpCode, expiresAt);
    } catch (error) {
      this.logger.error(
        `Failed to send vendor OTP email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        'Unable to send OTP email right now. Please check email configuration and try again.',
      );
    }

    const response: Record<string, unknown> = {
      email,
      expiresInSeconds: 300,
      message: 'OTP sent to your email address.',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.developmentOtpCode = otpCode;
    }

    return response;
  }

  async verifyPhoneOtp(userId: string, emailInput: string, codeInput: string) {
    const email = await this.resolveOtpEmail(userId, emailInput);
    const code = String(codeInput || '').trim();

    if (!/^[0-9]{6}$/.test(code)) {
      throw new BadRequestException('A valid 6-digit OTP code is required');
    }

    const now = new Date();
    const challenge = await this.otpChallengesRepo
      .createQueryBuilder('otp')
      .where('otp.userId = :userId', { userId })
      .andWhere('otp.phone = :channel', { channel: this.emailOtpChannel })
      .andWhere('otp.verifiedAt IS NULL')
      .andWhere('otp.expiresAt >= :now', { now })
      .orderBy('otp.createdAt', 'DESC')
      .getOne();

    if (!challenge) {
      throw new BadRequestException('OTP expired or not found. Request a new OTP.');
    }

    if (Number(challenge.attemptCount || 0) >= 5) {
      throw new BadRequestException('Too many invalid OTP attempts. Request a new OTP.');
    }

    const expectedHash = this.hashOtp(email, code);
    if (challenge.otpHash !== expectedHash) {
      challenge.attemptCount = Number(challenge.attemptCount || 0) + 1;
      await this.otpChallengesRepo.save(challenge);
      throw new BadRequestException('Invalid OTP code');
    }

    challenge.verifiedAt = now;
    challenge.attemptCount = Number(challenge.attemptCount || 0) + 1;
    await this.otpChallengesRepo.save(challenge);

    const existingVendor = await this.findByUserIdRaw(userId, false);
    if (existingVendor) {
      await this.vendorsRepo.update(existingVendor.id, {
        phoneOtpVerifiedAt: now,
      });

      await this.logVerificationStatus(existingVendor.id, {
        status:
          existingVendor.verificationStatus ||
          VendorVerificationStatus.PENDING_VERIFICATION,
        actionType: VendorVerificationAction.OTP_VERIFIED,
        reason: 'Email OTP verified',
      });
    }

    return {
      verified: true,
      email,
      verifiedAt: now,
    };
  }

  async submitRegistration(userId: string, data: Record<string, any>) {
    const vendorType = this.normalizeVendorType(data.vendorType);
    const ownerFullName =
      this.normalizeText(data.ownerFullName) || this.normalizeText(data.fullName);
    const businessNameInput = this.normalizeText(data.businessName);
    const businessName =
      businessNameInput ||
      (vendorType === VendorType.INDIVIDUAL_OWNER && ownerFullName
        ? `${ownerFullName} Rentals`
        : null);

    const address = this.normalizeText(data.address);
    const phone = this.normalizePhone(data.phone || data.contactNumber);
    const businessRegistrationType = this.normalizeBusinessRegistrationType(
      data.businessRegistrationType,
    );
    const businessRegistrationNumber = this.normalizeIdentifier(
      data.businessRegistrationNumber,
    );
    const governmentIdNumber = this.normalizeIdentifier(
      data.governmentIdNumber || data.govIdNumber,
    );

    const existing = await this.findByUserIdRaw(userId, true);
    if (
      existing &&
      existing.registrationStatus === VendorRegistrationStatus.APPROVED &&
      existing.isVerified
    ) {
      throw new BadRequestException('Vendor account is already approved');
    }

    this.validateRegistrationPayload({
      vendorType,
      businessName,
      address,
      ownerFullName,
      phone,
      businessRegistrationType,
      businessRegistrationNumber,
      governmentIdNumber,
    });

    const otpChallenge = await this.getLatestVerifiedOtpChallenge(
      userId,
      this.emailOtpChannel,
    );
    if (!otpChallenge) {
      throw new BadRequestException(
        'Email OTP verification is required before vendor registration',
      );
    }

    const candidateGovernmentIdUrl =
      this.normalizeText(data.governmentIdUrl) ||
      this.normalizeText(data.kycDocumentUrl);
    const candidateSelfieUrl =
      this.normalizeText(data.selfieUrl) ||
      this.normalizeText(data.selfieVerificationUrl);

    const hasExistingGovernmentId = existing
      ? await this.hasDocument(existing.id, VendorDocumentType.GOVERNMENT_ID)
      : false;
    const hasExistingSelfie = existing
      ? await this.hasDocument(existing.id, VendorDocumentType.SELFIE_VERIFICATION)
      : false;

    if (!candidateGovernmentIdUrl && !hasExistingGovernmentId) {
      throw new BadRequestException('Government ID upload is required');
    }
    if (!candidateSelfieUrl && !hasExistingSelfie) {
      throw new BadRequestException('Selfie verification upload is required');
    }

    const slugSeed = businessName || data.slug || `vendor-${userId.slice(0, 8)}`;
    const slug = await this.ensureSlugAvailable(slugSeed, existing?.id);

    const deviceFingerprintHash = this.hashValue(
      data.deviceFingerprint || data.deviceId || null,
    );

    const duplicateDetection = await this.detectPotentialDuplicates(
      {
        userId,
        governmentIdNumber,
        businessRegistrationNumber,
        phone,
        deviceFingerprintHash,
      },
      existing?.id,
    );

    const faceMatch = this.evaluateFaceMatch(candidateGovernmentIdUrl, candidateSelfieUrl);

    const payload: Partial<Vendor> = {
      userId,
      vendorType,
      businessName,
      businessRegistrationType,
      businessRegistrationNumber,
      birTin: this.normalizeTin(data.birTin),
      ownerFullName,
      governmentIdNumber,
      address,
      latitude: this.parseOptionalNumber(data.latitude),
      longitude: this.parseOptionalNumber(data.longitude),
      slug,
      description: this.normalizeText(data.description),
      phone,
      phoneOtpVerifiedAt: otpChallenge.verifiedAt,
      socialMediaLink: this.normalizeText(data.socialMediaLink),
      logoUrl: this.normalizeText(data.logoUrl),
      kycDocumentUrl: candidateGovernmentIdUrl,
      kycNotes: this.normalizeText(data.kycNotes),
      rejectionReason: null,
      registrationStatus: VendorRegistrationStatus.PENDING,
      kycStatus: VendorKycStatus.PENDING,
      verificationStatus: VendorVerificationStatus.PENDING_VERIFICATION,
      verificationBadge: null,
      reviewedAt: null,
      reviewedByUserId: null,
      isVerified: false,
      isActive: false,
      kycSubmittedAt: new Date(),
      deviceFingerprintHash,
      duplicateRiskScore: duplicateDetection.riskScore,
      duplicateSignals: duplicateDetection.signals.length
        ? JSON.stringify(duplicateDetection.signals)
        : null,
      isSuspicious: duplicateDetection.riskScore >= 50,
      suspiciousReason:
        duplicateDetection.riskScore >= 50
          ? `Duplicate risk score ${duplicateDetection.riskScore}`
          : null,
      faceMatchStatus: faceMatch.status,
      faceMatchScore: faceMatch.score,
    };

    let vendorId = existing?.id;
    if (existing) {
      await this.vendorsRepo.update(existing.id, payload);
      vendorId = existing.id;
    } else {
      const created = await this.vendorsRepo.save(this.vendorsRepo.create(payload));
      vendorId = created.id;
    }

    await this.syncRegistrationDocuments(vendorId, data);

    await this.logVerificationStatus(vendorId, {
      status: VendorVerificationStatus.PENDING_VERIFICATION,
      actionType: VendorVerificationAction.SUBMITTED,
      reason: 'Vendor KYC registration submitted',
      riskScore: duplicateDetection.riskScore,
      duplicateSignals: duplicateDetection.signals,
    });

    if (duplicateDetection.signals.length) {
      await this.logVerificationStatus(vendorId, {
        status: VendorVerificationStatus.PENDING_VERIFICATION,
        actionType: VendorVerificationAction.DUPLICATE_SIGNAL,
        reason: 'Duplicate detection signals were found',
        riskScore: duplicateDetection.riskScore,
        duplicateSignals: duplicateDetection.signals,
      });
    }

    return this.findById(vendorId, true);
  }

  async update(id: string, data: Partial<Vendor>) {
    const payload: Partial<Vendor> = {
      ...data,
      vendorType: this.normalizeVendorType(data.vendorType),
      businessRegistrationType: this.normalizeBusinessRegistrationType(
        data.businessRegistrationType,
      ),
      businessRegistrationNumber: this.normalizeIdentifier(
        data.businessRegistrationNumber,
      ),
      birTin: this.normalizeTin(data.birTin),
      ownerFullName: this.normalizeText(data.ownerFullName),
      governmentIdNumber: this.normalizeIdentifier(data.governmentIdNumber),
      phone: this.normalizePhone(data.phone),
      socialMediaLink: this.normalizeText(data.socialMediaLink),
    };

    await this.vendorsRepo.update(id, payload);
    return this.findById(id, true);
  }

  async getMyKycSubmission(userId: string) {
    const vendor = await this.findByUserIdRaw(userId, true);
    if (!vendor) throw new NotFoundException('Vendor profile not found');
    return this.withVerificationBadge(vendor);
  }

  async getKycSubmission(vendorId: string) {
    const vendor = await this.findByIdRaw(vendorId, true);
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.withVerificationBadge(vendor);
  }

  async findRegistrationRequests(status?: string) {
    const normalizedStatus = String(status || '').trim().toLowerCase();

    let where: any = { verificationStatus: VendorVerificationStatus.PENDING_VERIFICATION };

    if (
      normalizedStatus === 'approved' ||
      normalizedStatus === VendorRegistrationStatus.APPROVED
    ) {
      where = {
        verificationStatus: In([
          VendorVerificationStatus.VERIFIED_BUSINESS,
          VendorVerificationStatus.VERIFIED_OWNER,
        ]),
      };
    } else if (
      normalizedStatus === 'rejected' ||
      normalizedStatus === VendorRegistrationStatus.REJECTED ||
      normalizedStatus === VendorVerificationStatus.REJECTED
    ) {
      where = { verificationStatus: VendorVerificationStatus.REJECTED };
    } else if (
      normalizedStatus === VendorVerificationStatus.VERIFIED_BUSINESS ||
      normalizedStatus === VendorVerificationStatus.VERIFIED_OWNER ||
      normalizedStatus === VendorVerificationStatus.PENDING_VERIFICATION
    ) {
      where = { verificationStatus: normalizedStatus };
    }

    const vendors = await this.vendorsRepo.find({
      where,
      relations: ['user', 'documents'],
      order: { createdAt: 'DESC' },
    });

    return vendors.map((vendor) => this.withVerificationBadge(vendor));
  }

  async reviewRegistration(
    id: string,
    decision: 'approve' | 'reject',
    notes?: string,
    reviewedByUserId?: string,
  ) {
    const vendor = await this.findByIdRaw(id, true);
    if (!vendor) throw new NotFoundException('Vendor not found');

    if (decision !== 'approve' && decision !== 'reject') {
      throw new BadRequestException('decision must be either approve or reject');
    }

    const reason = this.normalizeText(notes);

    if (decision === 'reject' && !reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    if (decision === 'approve') {
      await this.validateVendorForApproval(vendor);

      const approvedStatus = this.mapVendorTypeToVerifiedStatus(vendor.vendorType);

      await this.vendorsRepo.update(id, {
        registrationStatus: VendorRegistrationStatus.APPROVED,
        kycStatus: VendorKycStatus.APPROVED,
        verificationStatus: approvedStatus,
        verificationBadge: this.getVerificationBadgeLabel(approvedStatus),
        isVerified: true,
        isActive: true,
        kycNotes: reason || vendor.kycNotes,
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedByUserId: reviewedByUserId || null,
      });

      await this.documentsRepo
        .createQueryBuilder()
        .update(VendorDocument)
        .set({
          status: VendorDocumentStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedByUserId: reviewedByUserId || null,
        })
        .where('vendorId = :vendorId', { vendorId: id })
        .andWhere('status IN (:...statuses)', {
          statuses: [
            VendorDocumentStatus.PENDING,
            VendorDocumentStatus.NEEDS_MANUAL_REVIEW,
          ],
        })
        .execute();

      await this.usersService.updateRole(vendor.userId, UserRole.VENDOR);

      await this.logVerificationStatus(id, {
        status: approvedStatus,
        actionType: VendorVerificationAction.APPROVED,
        reason: reason || 'Vendor approved',
        reviewedByUserId,
      });

      // Send approval email
      const badgeLabel = this.getVerificationBadgeLabel(approvedStatus);
      await this.emailService.sendVendorApprovalEmail(
        vendor.user?.email || vendor.userId,
        vendor.businessName,
        badgeLabel,
        vendor.vendorType || 'registered_business',
        vendor.businessName,
      );
    } else {
      await this.vendorsRepo.update(id, {
        registrationStatus: VendorRegistrationStatus.REJECTED,
        kycStatus: VendorKycStatus.REJECTED,
        verificationStatus: VendorVerificationStatus.REJECTED,
        verificationBadge: null,
        isVerified: false,
        isActive: false,
        kycNotes: reason || 'KYC rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: reviewedByUserId || null,
      });

      await this.documentsRepo
        .createQueryBuilder()
        .update(VendorDocument)
        .set({
          status: VendorDocumentStatus.REJECTED,
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedByUserId: reviewedByUserId || null,
        })
        .where('vendorId = :vendorId', { vendorId: id })
        .andWhere('status IN (:...statuses)', {
          statuses: [
            VendorDocumentStatus.PENDING,
            VendorDocumentStatus.NEEDS_MANUAL_REVIEW,
          ],
        })
        .execute();

      if (vendor.registrationStatus !== VendorRegistrationStatus.APPROVED) {
        await this.usersService.updateRole(vendor.userId, UserRole.CUSTOMER);
      }

      await this.logVerificationStatus(id, {
        status: VendorVerificationStatus.REJECTED,
        actionType: VendorVerificationAction.REJECTED,
        reason,
        reviewedByUserId,
      });
    }

    return this.findById(id, true);
  }

  async listMyVendorDocuments(userId: string) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    return this.documentsRepo.find({
      where: { vendorId: vendor.id },
      order: { createdAt: 'DESC' },
    });
  }

  async listVendorDocuments(vendorId: string) {
    return this.documentsRepo.find({
      where: { vendorId },
      order: { createdAt: 'DESC' },
    });
  }

  async uploadVendorDocument(
    userId: string,
    documentTypeInput: string,
    fileUrlInput: string,
    metadata?: Record<string, unknown>,
  ) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    const documentType = this.normalizeDocumentType(documentTypeInput);
    if (!documentType) {
      throw new BadRequestException('Invalid documentType');
    }

    const fileUrl = this.normalizeText(fileUrlInput);
    if (!fileUrl) {
      throw new BadRequestException('A document file URL is required');
    }

    const document = this.documentsRepo.create({
      vendorId: vendor.id,
      documentType,
      fileUrl,
      fileHash: this.hashValue(fileUrl),
      metadata: metadata ? JSON.stringify(metadata) : null,
      status: VendorDocumentStatus.PENDING,
    });

    const savedDocument = await this.documentsRepo.save(document);

    if (documentType === VendorDocumentType.GOVERNMENT_ID) {
      await this.vendorsRepo.update(vendor.id, { kycDocumentUrl: fileUrl });
    }
    if (documentType === VendorDocumentType.BUSINESS_LOGO) {
      await this.vendorsRepo.update(vendor.id, { logoUrl: fileUrl });
    }

    return savedDocument;
  }

  async createVendorItem(userId: string, data: Record<string, any>) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    const title = this.normalizeText(data.title);
    if (!title) throw new BadRequestException('title is required');

    const item = this.vendorItemsRepo.create({
      vendorId: vendor.id,
      inventoryItemId: this.normalizeText(data.inventoryItemId),
      title,
      description: this.normalizeText(data.description),
      verificationStatus: VendorItemVerificationStatus.PENDING,
      rejectionReason: null,
    });

    const saved = await this.vendorItemsRepo.save(item);
    return this.vendorItemsRepo.findOne({
      where: { id: saved.id },
      relations: ['photos'],
    });
  }

  async listMyVendorItems(userId: string) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    return this.vendorItemsRepo.find({
      where: { vendorId: vendor.id },
      relations: ['photos'],
      order: { createdAt: 'DESC' },
    });
  }

  async listVendorItems(vendorId: string) {
    return this.vendorItemsRepo.find({
      where: { vendorId },
      relations: ['photos'],
      order: { createdAt: 'DESC' },
    });
  }

  async uploadVendorItemPhoto(
    userId: string,
    vendorItemId: string,
    photoTypeInput: string,
    fileUrlInput: string,
    metadata?: Record<string, unknown>,
  ) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    const vendorItem = await this.vendorItemsRepo.findOne({
      where: { id: vendorItemId },
    });
    if (!vendorItem) throw new NotFoundException('Vendor item not found');
    if (vendorItem.vendorId !== vendor.id) {
      throw new ForbiddenException('You can only upload photos for your own vendor items');
    }

    const photoType = this.normalizeVendorItemPhotoType(photoTypeInput);
    if (!photoType) throw new BadRequestException('Invalid photoType');

    const fileUrl = this.normalizeText(fileUrlInput);
    if (!fileUrl) throw new BadRequestException('A photo file URL is required');

    const photo = this.vendorItemPhotosRepo.create({
      vendorItemId,
      photoType,
      fileUrl,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    await this.vendorItemPhotosRepo.save(photo);

    // Item verification remains pending until admin review, but require both proof photos.
    const photos = await this.vendorItemPhotosRepo.find({ where: { vendorItemId } });
    const uploadedTypes = new Set(photos.map((itemPhoto) => itemPhoto.photoType));

    if (
      uploadedTypes.has(VendorItemPhotoType.ITEM_ONLY) &&
      uploadedTypes.has(VendorItemPhotoType.WITH_VENDOR_NAME_AND_DATE)
    ) {
      await this.vendorItemsRepo.update(vendorItemId, {
        verificationStatus: VendorItemVerificationStatus.PENDING,
        rejectionReason: null,
      });
    }

    return this.vendorItemsRepo.findOne({
      where: { id: vendorItemId },
      relations: ['photos'],
    });
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm = 50,
    itemTypeIds: string[] = [],
    helpersNeeded = 0,
    startDate?: string,
    endDate?: string,
  ) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng query parameters are required');
    }

    const safeRadius =
      Number.isFinite(radiusKm) && radiusKm > 0 ? Number(radiusKm) : 50;
    const safeHelpersNeeded =
      Number.isFinite(helpersNeeded) && helpersNeeded >= 0
        ? Math.max(0, Math.floor(Number(helpersNeeded)))
        : 0;
    const requiredItemTypeIds = [...new Set(itemTypeIds.filter(Boolean))];
    const dateRange = this.parseDateRange(startDate, endDate);

    const vendors = await this.vendorsRepo.find({
      where: [
        {
          isActive: true,
          isVerified: true,
          verificationStatus: In([
            VendorVerificationStatus.VERIFIED_BUSINESS,
            VendorVerificationStatus.VERIFIED_OWNER,
          ]),
        },
        {
          isActive: true,
          isVerified: true,
          registrationStatus: VendorRegistrationStatus.APPROVED,
        },
      ],
      relations: ['user'],
    });

    const vendorIds = vendors.map((vendor) => vendor.id);
    if (!vendorIds.length) return [];

    const inventoryFilter: any = {
      vendorId: In(vendorIds),
      ...(dateRange
        ? { quantity: MoreThan(0) }
        : { availableQuantity: MoreThan(0) }),
    };
    if (requiredItemTypeIds.length) {
      inventoryFilter.itemTypeId = In(requiredItemTypeIds);
    }

    const inventories = await this.inventoryRepo.find({ where: inventoryFilter });
    const deliveryRates = await this.deliveryRatesRepo.find({
      where: { vendorId: In(vendorIds) },
      order: { distanceKm: 'ASC' },
    });

    const availableQuantityByVendorItemType = new Map<string, Map<string, number>>();
    for (const inventory of inventories) {
      const vendorQuantities =
        availableQuantityByVendorItemType.get(inventory.vendorId) ||
        new Map<string, number>();
      const availableQuantity = Number(
        dateRange ? inventory.quantity || 0 : inventory.availableQuantity || 0,
      );
      const currentQuantity = vendorQuantities.get(inventory.itemTypeId) || 0;
      vendorQuantities.set(
        inventory.itemTypeId,
        currentQuantity + Math.max(0, availableQuantity),
      );
      availableQuantityByVendorItemType.set(inventory.vendorId, vendorQuantities);
    }

    const ratesByVendor = new Map<string, DeliveryRate[]>();
    for (const rate of deliveryRates) {
      const list = ratesByVendor.get(rate.vendorId) || [];
      list.push(rate);
      ratesByVendor.set(rate.vendorId, list);
    }

    const reservedQuantityByVendorItemType = new Map<
      string,
      Map<string, number>
    >();

    if (dateRange) {
      const overlappingBookings = await this.bookingsRepo
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.items', 'item')
        .leftJoinAndSelect('item.inventoryItem', 'inventoryItem')
        .where('booking.vendorId IN (:...vendorIds)', { vendorIds })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .andWhere('booking.startDate <= :rangeEnd', {
          rangeEnd: dateRange.endDate,
        })
        .andWhere('booking.endDate >= :rangeStart', {
          rangeStart: dateRange.startDate,
        })
        .getMany();

      for (const booking of overlappingBookings) {
        const vendorReservedMap =
          reservedQuantityByVendorItemType.get(booking.vendorId) ||
          new Map<string, number>();

        for (const bookingItem of booking.items || []) {
          const itemTypeId = bookingItem.inventoryItem?.itemTypeId;
          if (!itemTypeId) continue;

          const quantity = Number(bookingItem.quantity || 0);
          if (!Number.isFinite(quantity) || quantity <= 0) continue;

          const currentReserved = vendorReservedMap.get(itemTypeId) || 0;
          vendorReservedMap.set(itemTypeId, currentReserved + quantity);
        }

        reservedQuantityByVendorItemType.set(booking.vendorId, vendorReservedMap);
      }
    }

    return vendors
      .map((vendor) => {
        const vendorLat = Number(vendor.latitude);
        const vendorLng = Number(vendor.longitude);
        if (
          vendor.latitude == null ||
          vendor.longitude == null ||
          !Number.isFinite(vendorLat) ||
          !Number.isFinite(vendorLng)
        ) {
          return null;
        }

        const distanceKm = this.haversine(lat, lng, vendorLat, vendorLng);
        if (!Number.isFinite(distanceKm)) return null;

        const availableQuantityByItemType =
          availableQuantityByVendorItemType.get(vendor.id) ||
          new Map<string, number>();
        const reservedByItemType =
          reservedQuantityByVendorItemType.get(vendor.id) ||
          new Map<string, number>();

        const hasAvailableQuantityForItemType = (itemTypeId: string) => {
          const baseAvailable = availableQuantityByItemType.get(itemTypeId) || 0;
          if (!dateRange) return baseAvailable > 0;

          const reserved = reservedByItemType.get(itemTypeId) || 0;
          return baseAvailable - reserved > 0;
        };

        const hasAllRequiredItems = requiredItemTypeIds.every(
          hasAvailableQuantityForItemType,
        );

        const hasAnyDateRangeAvailability = !dateRange
          ? true
          : Array.from(availableQuantityByItemType.entries()).some(
              ([itemTypeId, available]) => {
                const reserved = reservedByItemType.get(itemTypeId) || 0;
                return available - reserved > 0;
              },
            );

        const deliveryEstimate = this.estimateDeliveryCharge(
          distanceKm,
          safeHelpersNeeded,
          ratesByVendor.get(vendor.id) || [],
        );

        return {
          ...vendor,
          verificationBadge: this.getVerificationBadgeLabel(vendor.verificationStatus),
          distanceKm,
          matchedItemTypeCount: requiredItemTypeIds.filter((requiredItemTypeId) =>
            hasAvailableQuantityForItemType(requiredItemTypeId),
          ).length,
          hasAllRequiredItems,
          hasAnyDateRangeAvailability,
          estimatedDeliveryCharge: deliveryEstimate?.chargeAmount ?? null,
          estimatedHelpersCount:
            deliveryEstimate?.helpersCount ?? safeHelpersNeeded,
          estimatedDistanceTierKm: deliveryEstimate?.distanceTierKm ?? null,
        };
      })
      .filter(
        (vendor): vendor is NonNullable<typeof vendor> =>
          Boolean(vendor) &&
          vendor.distanceKm <= safeRadius &&
          (requiredItemTypeIds.length === 0
            ? vendor.hasAnyDateRangeAvailability
            : vendor.hasAllRequiredItems),
      )
      .sort((a, b) =>
        this.compareVendorsByBestCriteria(a, b, requiredItemTypeIds.length),
      );
  }

  private compareVendorsByBestCriteria(
    a: {
      businessName: string;
      warningCount: number;
      distanceKm: number;
      matchedItemTypeCount: number;
      hasAllRequiredItems: boolean;
      hasAnyDateRangeAvailability: boolean;
      estimatedDeliveryCharge: number | null;
    },
    b: {
      businessName: string;
      warningCount: number;
      distanceKm: number;
      matchedItemTypeCount: number;
      hasAllRequiredItems: boolean;
      hasAnyDateRangeAvailability: boolean;
      estimatedDeliveryCharge: number | null;
    },
    requiredItemTypeCount: number,
  ) {
    if (requiredItemTypeCount > 0) {
      if (a.hasAllRequiredItems !== b.hasAllRequiredItems) {
        return a.hasAllRequiredItems ? -1 : 1;
      }

      if (a.matchedItemTypeCount !== b.matchedItemTypeCount) {
        return b.matchedItemTypeCount - a.matchedItemTypeCount;
      }
    } else if (a.hasAnyDateRangeAvailability !== b.hasAnyDateRangeAvailability) {
      return a.hasAnyDateRangeAvailability ? -1 : 1;
    }

    const chargeComparison = this.compareNullableNumberAscending(
      a.estimatedDeliveryCharge,
      b.estimatedDeliveryCharge,
    );
    if (chargeComparison !== 0) return chargeComparison;

    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }

    if (a.warningCount !== b.warningCount) {
      return a.warningCount - b.warningCount;
    }

    return a.businessName.localeCompare(b.businessName);
  }

  private compareNullableNumberAscending(
    left: number | null | undefined,
    right: number | null | undefined,
  ) {
    const leftNull = left == null || !Number.isFinite(Number(left));
    const rightNull = right == null || !Number.isFinite(Number(right));

    if (leftNull && rightNull) return 0;
    if (leftNull) return 1;
    if (rightNull) return -1;

    return Number(left) - Number(right);
  }

  private parseDateRange(startDate?: string, endDate?: string) {
    const normalizedStart = String(startDate || '').trim();
    const normalizedEnd = String(endDate || '').trim();

    if (!normalizedStart && !normalizedEnd) return null;

    if (!normalizedStart || !normalizedEnd) {
      throw new BadRequestException(
        'startDate and endDate must be provided together',
      );
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(normalizedStart) || !datePattern.test(normalizedEnd)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const startTs = Date.parse(`${normalizedStart}T00:00:00Z`);
    const endTs = Date.parse(`${normalizedEnd}T00:00:00Z`);
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      throw new BadRequestException('Invalid date range.');
    }

    if (endTs < startTs) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return {
      startDate: normalizedStart,
      endDate: normalizedEnd,
    };
  }

  private estimateDeliveryCharge(
    distanceKm: number,
    helpersNeeded: number,
    deliveryRates: DeliveryRate[],
  ) {
    const normalizedRates = deliveryRates
      .map((rate) => {
        const parsedHelpersCount = Number(rate.helpersCount);
        const parsedDistanceKm = Number(rate.distanceKm);
        const parsedChargeAmount = Number(rate.chargeAmount);

        return {
          helpersCount: Number.isFinite(parsedHelpersCount)
            ? Math.max(0, Math.floor(parsedHelpersCount))
            : 0,
          distanceTierKm: Number.isFinite(parsedDistanceKm)
            ? parsedDistanceKm
            : 0,
          chargeAmount: Number.isFinite(parsedChargeAmount)
            ? parsedChargeAmount
            : 0,
        };
      })
      .filter(
        (rate) =>
          Number.isFinite(rate.helpersCount) &&
          Number.isFinite(rate.distanceTierKm) &&
          Number.isFinite(rate.chargeAmount),
      )
      .sort((a, b) => {
        if (a.distanceTierKm !== b.distanceTierKm) {
          return a.distanceTierKm - b.distanceTierKm;
        }
        return a.helpersCount - b.helpersCount;
      });

    if (!normalizedRates.length) return null;

    const helperScopedRates = normalizedRates.filter(
      (rate) => rate.helpersCount >= helpersNeeded,
    );
    const targetRates = helperScopedRates.length
      ? helperScopedRates
      : normalizedRates;

    return (
      targetRates.find((rate) => rate.distanceTierKm >= distanceKm) ||
      targetRates[targetRates.length - 1]
    );
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async warn(id: string) {
    const vendor = await this.findByIdRaw(id, false);
    if (!vendor) throw new NotFoundException('Vendor not found');

    vendor.warningCount = Number(vendor.warningCount || 0) + 1;
    if (vendor.warningCount >= 3) {
      const suspended = new Date();
      suspended.setDate(suspended.getDate() + 7);
      vendor.suspendedUntil = suspended;
      vendor.isActive = false;
    }

    const saved = await this.vendorsRepo.save(vendor);
    return this.withVerificationBadge(saved);
  }

  async verify(id: string, isVerified: boolean, reviewedByUserId?: string) {
    const vendor = await this.findByIdRaw(id, false);
    if (!vendor) throw new NotFoundException('Vendor not found');

    if (isVerified) {
      const status = this.mapVendorTypeToVerifiedStatus(vendor.vendorType);
      await this.vendorsRepo.update(id, {
        isVerified: true,
        isActive: true,
        verificationStatus: status,
        verificationBadge: this.getVerificationBadgeLabel(status),
        registrationStatus: VendorRegistrationStatus.APPROVED,
        kycStatus: VendorKycStatus.APPROVED,
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedByUserId: reviewedByUserId || null,
      });

      await this.usersService.updateRole(vendor.userId, UserRole.VENDOR);

      await this.logVerificationStatus(id, {
        status,
        actionType: VendorVerificationAction.APPROVED,
        reason: 'Vendor manually verified by admin',
        reviewedByUserId,
      });
    } else {
      await this.vendorsRepo.update(id, {
        isVerified: false,
        isActive: false,
        verificationStatus: VendorVerificationStatus.REJECTED,
        verificationBadge: null,
        registrationStatus: VendorRegistrationStatus.REJECTED,
        kycStatus: VendorKycStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedByUserId: reviewedByUserId || null,
      });

      await this.logVerificationStatus(id, {
        status: VendorVerificationStatus.REJECTED,
        actionType: VendorVerificationAction.REJECTED,
        reason: 'Vendor manually unverified by admin',
        reviewedByUserId,
      });
    }

    return this.findById(id, true);
  }

  async setActive(
    id: string,
    isActive: boolean,
    reason?: string,
    reviewedByUserId?: string,
  ) {
    const vendor = await this.findByIdRaw(id, false);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const normalizedReason = this.normalizeText(reason);
    await this.vendorsRepo.update(id, {
      isActive,
      suspendedUntil: isActive ? null : vendor.suspendedUntil,
      kycNotes: normalizedReason || vendor.kycNotes,
    });

    await this.logVerificationStatus(id, {
      status:
        vendor.verificationStatus ||
        VendorVerificationStatus.PENDING_VERIFICATION,
      actionType: isActive
        ? VendorVerificationAction.REACTIVATED
        : VendorVerificationAction.SUSPENDED,
      reason: normalizedReason || (isActive ? 'Vendor reactivated' : 'Vendor suspended'),
      reviewedByUserId,
    });

    return this.findById(id, true);
  }

  async suspend(
    id: string,
    reason: string,
    suspendedUntil?: string,
    reviewedByUserId?: string,
  ) {
    const vendor = await this.findByIdRaw(id, false);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const normalizedReason = this.normalizeText(reason);
    if (!normalizedReason) {
      throw new BadRequestException('Suspension reason is required');
    }

    let parsedSuspendedUntil: Date = null;
    if (suspendedUntil) {
      const parsed = new Date(suspendedUntil);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid suspendedUntil date');
      }
      parsedSuspendedUntil = parsed;
    }

    await this.vendorsRepo.update(id, {
      isActive: false,
      suspendedUntil: parsedSuspendedUntil,
      kycNotes: normalizedReason,
    });

    await this.logVerificationStatus(id, {
      status:
        vendor.verificationStatus ||
        VendorVerificationStatus.PENDING_VERIFICATION,
      actionType: VendorVerificationAction.SUSPENDED,
      reason: normalizedReason,
      reviewedByUserId,
    });

    return this.findById(id, true);
  }

  async flagSuspicious(
    id: string,
    flagged: boolean,
    reason?: string,
    reviewedByUserId?: string,
  ) {
    const vendor = await this.findByIdRaw(id, false);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const normalizedReason = this.normalizeText(reason);

    await this.vendorsRepo.update(id, {
      isSuspicious: Boolean(flagged),
      suspiciousReason: normalizedReason,
    });

    await this.logVerificationStatus(id, {
      status:
        vendor.verificationStatus ||
        VendorVerificationStatus.PENDING_VERIFICATION,
      actionType: VendorVerificationAction.FLAGGED,
      reason:
        normalizedReason ||
        (flagged ? 'Vendor flagged as suspicious' : 'Suspicious flag removed'),
      reviewedByUserId,
    });

    return this.findById(id, true);
  }

  private async ensureSlugAvailable(slugLike: string, excludeId?: string) {
    const base = this.normalizeSlug(slugLike) || `vendor-${Date.now()}`;
    let candidate = base;
    let suffix = 1;

    while (true) {
      const existing = await this.vendorsRepo.findOne({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${suffix++}`;
    }
  }

  private normalizeSlug(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private normalizeVendorType(input?: VendorType | string) {
    const normalized = String(input || '').trim().toLowerCase();
    if (normalized === VendorType.INDIVIDUAL_OWNER) {
      return VendorType.INDIVIDUAL_OWNER;
    }
    return VendorType.REGISTERED_BUSINESS;
  }

  private normalizeVerificationStatus(
    input?: VendorVerificationStatus | string,
  ): VendorVerificationStatus | null {
    const normalized = String(input || '').trim().toLowerCase();
    if (
      normalized === VendorVerificationStatus.PENDING_VERIFICATION ||
      normalized === VendorVerificationStatus.VERIFIED_BUSINESS ||
      normalized === VendorVerificationStatus.VERIFIED_OWNER ||
      normalized === VendorVerificationStatus.REJECTED
    ) {
      return normalized as VendorVerificationStatus;
    }
    return null;
  }

  private normalizeBusinessRegistrationType(
    input?: BusinessRegistrationType | string,
  ): BusinessRegistrationType | null {
    const normalized = String(input || '').trim().toLowerCase();
    if (normalized === BusinessRegistrationType.DTI) {
      return BusinessRegistrationType.DTI;
    }
    if (normalized === BusinessRegistrationType.SEC) {
      return BusinessRegistrationType.SEC;
    }
    return null;
  }

  private normalizeText(input: unknown): string | null {
    const normalized = String(input || '').trim();
    return normalized || null;
  }

  private normalizeIdentifier(input: unknown): string | null {
    const normalized = String(input || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!normalized) return null;
    return normalized;
  }

  private normalizeTin(input: unknown): string | null {
    const normalized = String(input || '')
      .trim()
      .replace(/[^0-9-]/g, '');
    if (!normalized) return null;
    if (!/^\d{3,4}-?\d{3,4}-?\d{3,4}$/.test(normalized)) {
      throw new BadRequestException('BIR TIN must follow a valid numeric format');
    }
    return normalized;
  }

  private normalizePhone(input: unknown): string | null {
    const normalized = String(input || '').replace(/[^0-9+]/g, '');
    if (!normalized) return null;

    const withoutPlus = normalized.startsWith('+')
      ? normalized.slice(1)
      : normalized;

    if (!/^\d{10,15}$/.test(withoutPlus)) {
      throw new BadRequestException('Phone number must contain 10 to 15 digits');
    }

    return normalized;
  }

  private normalizeEmail(input: unknown): string | null {
    const normalized = String(input || '').trim().toLowerCase();
    if (!normalized) return null;
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      throw new BadRequestException('A valid email address is required');
    }
    return normalized;
  }

  private parseOptionalNumber(input: unknown): number | null {
    if (input === undefined || input === null || String(input).trim() === '') {
      return null;
    }
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  private normalizeDocumentType(input: string): VendorDocumentType | null {
    const normalized = String(input || '').trim().toLowerCase();

    if (
      normalized === VendorDocumentType.GOVERNMENT_ID ||
      normalized === 'government-id' ||
      normalized === 'gov_id' ||
      normalized === 'governmentid'
    ) {
      return VendorDocumentType.GOVERNMENT_ID;
    }

    if (
      normalized === VendorDocumentType.SELFIE_VERIFICATION ||
      normalized === 'selfie' ||
      normalized === 'selfie_verification'
    ) {
      return VendorDocumentType.SELFIE_VERIFICATION;
    }

    if (
      normalized === VendorDocumentType.MAYORS_PERMIT ||
      normalized === 'mayor_permit' ||
      normalized === 'mayors-permit'
    ) {
      return VendorDocumentType.MAYORS_PERMIT;
    }

    if (
      normalized === VendorDocumentType.BARANGAY_PERMIT ||
      normalized === 'barangay-permit'
    ) {
      return VendorDocumentType.BARANGAY_PERMIT;
    }

    if (
      normalized === VendorDocumentType.BUSINESS_LOGO ||
      normalized === 'logo' ||
      normalized === 'business-logo'
    ) {
      return VendorDocumentType.BUSINESS_LOGO;
    }

    return null;
  }

  private normalizeVendorItemPhotoType(input: string): VendorItemPhotoType | null {
    const normalized = String(input || '').trim().toLowerCase();

    if (
      normalized === VendorItemPhotoType.ITEM_ONLY ||
      normalized === 'item' ||
      normalized === 'item_photo'
    ) {
      return VendorItemPhotoType.ITEM_ONLY;
    }

    if (
      normalized === VendorItemPhotoType.WITH_VENDOR_NAME_AND_DATE ||
      normalized === 'proof' ||
      normalized === 'proof_with_name_date' ||
      normalized === 'with_name_and_date'
    ) {
      return VendorItemPhotoType.WITH_VENDOR_NAME_AND_DATE;
    }

    return null;
  }

  private hashOtp(phone: string, otpCode: string) {
    const secret =
      process.env.OTP_SECRET || process.env.JWT_SECRET || 'chair-rental-otp-secret';
    return createHash('sha256')
      .update(`${secret}::${phone}::${otpCode}`)
      .digest('hex');
  }

  private hashValue(value: string | null) {
    if (!value) return null;
    return createHash('sha256').update(value).digest('hex');
  }

  private mapVendorTypeToVerifiedStatus(vendorType: VendorType) {
    return vendorType === VendorType.REGISTERED_BUSINESS
      ? VendorVerificationStatus.VERIFIED_BUSINESS
      : VendorVerificationStatus.VERIFIED_OWNER;
  }

  private getVerificationBadgeLabel(
    verificationStatus: VendorVerificationStatus,
  ): string | null {
    if (verificationStatus === VendorVerificationStatus.VERIFIED_BUSINESS) {
      return 'Verified Business';
    }
    if (verificationStatus === VendorVerificationStatus.VERIFIED_OWNER) {
      return 'Verified Owner';
    }
    return null;
  }

  private withVerificationBadge(vendor: Vendor | null) {
    if (!vendor) return null;

    if (!vendor.verificationBadge) {
      const normalizedStatus =
        vendor.verificationStatus === VendorVerificationStatus.PENDING_VERIFICATION &&
        vendor.isVerified &&
        vendor.registrationStatus === VendorRegistrationStatus.APPROVED
          ? this.mapVendorTypeToVerifiedStatus(vendor.vendorType)
          : vendor.verificationStatus;

      vendor.verificationBadge = this.getVerificationBadgeLabel(normalizedStatus);
    }

    return vendor;
  }

  private validateRegistrationPayload(payload: {
    vendorType: VendorType;
    businessName: string | null;
    address: string | null;
    ownerFullName: string | null;
    phone: string | null;
    businessRegistrationType: BusinessRegistrationType | null;
    businessRegistrationNumber: string | null;
    governmentIdNumber: string | null;
  }) {
    if (!payload.address) {
      throw new BadRequestException('Address is required');
    }

    if (!payload.phone) {
      throw new BadRequestException('Contact number is required');
    }

    if (
      !payload.governmentIdNumber ||
      !/^[A-Z0-9-]{6,32}$/.test(payload.governmentIdNumber)
    ) {
      throw new BadRequestException(
        'Government ID number is required and must be 6 to 32 characters',
      );
    }

    if (payload.vendorType === VendorType.REGISTERED_BUSINESS) {
      if (!payload.businessName) {
        throw new BadRequestException('Business name is required for registered businesses');
      }
      if (!payload.businessRegistrationType) {
        throw new BadRequestException('Business registration type must be DTI or SEC');
      }
      if (
        !payload.businessRegistrationNumber ||
        !/^[A-Z0-9-]{5,40}$/.test(payload.businessRegistrationNumber)
      ) {
        throw new BadRequestException(
          'Business registration number is required and must be valid',
        );
      }
      if (!payload.ownerFullName) {
        throw new BadRequestException('Owner full name is required');
      }
    }

    if (payload.vendorType === VendorType.INDIVIDUAL_OWNER && !payload.ownerFullName) {
      throw new BadRequestException('Full name is required for individual owners');
    }
  }

  private evaluateFaceMatch(
    governmentIdUrl?: string | null,
    selfieUrl?: string | null,
  ) {
    if (!governmentIdUrl || !selfieUrl) {
      return {
        status: 'missing_documents',
        score: null,
      };
    }

    // TODO: Integrate with a face-matching provider. For now this is manual review.
    return {
      status: 'manual_review_required',
      score: null,
    };
  }

  private async detectPotentialDuplicates(
    input: {
      userId: string;
      governmentIdNumber?: string | null;
      businessRegistrationNumber?: string | null;
      phone?: string | null;
      deviceFingerprintHash?: string | null;
    },
    excludeVendorId?: string,
  ) {
    const signals: string[] = [];
    let riskScore = 0;

    if (input.governmentIdNumber) {
      const match = await this.vendorsRepo.findOne({
        where: { governmentIdNumber: input.governmentIdNumber },
      });
      if (match && match.id !== excludeVendorId && match.userId !== input.userId) {
        signals.push('Government ID number already used by another vendor');
        riskScore += 45;
      }
    }

    if (input.businessRegistrationNumber) {
      const match = await this.vendorsRepo.findOne({
        where: { businessRegistrationNumber: input.businessRegistrationNumber },
      });
      if (match && match.id !== excludeVendorId && match.userId !== input.userId) {
        signals.push('Business registration number already used by another vendor');
        riskScore += 35;
      }
    }

    if (input.phone) {
      const match = await this.vendorsRepo.findOne({
        where: { phone: input.phone },
      });
      if (match && match.id !== excludeVendorId && match.userId !== input.userId) {
        signals.push('Phone number already used by another vendor');
        riskScore += 20;
      }
    }

    if (input.deviceFingerprintHash) {
      const match = await this.vendorsRepo.findOne({
        where: { deviceFingerprintHash: input.deviceFingerprintHash },
      });
      if (match && match.id !== excludeVendorId && match.userId !== input.userId) {
        signals.push('Device fingerprint overlaps with another vendor account');
        riskScore += 15;
      }
    }

    return {
      signals,
      riskScore: Math.min(100, riskScore),
    };
  }

  private async hasDocument(vendorId: string, documentType: VendorDocumentType) {
    const document = await this.documentsRepo.findOne({
      where: {
        vendorId,
        documentType,
      },
      order: { createdAt: 'DESC' },
    });

    return Boolean(document);
  }

  private async validateVendorForApproval(vendor: Vendor) {
    if (!vendor.phoneOtpVerifiedAt) {
      throw new BadRequestException('Vendor email OTP must be verified before approval');
    }

    this.validateRegistrationPayload({
      vendorType: vendor.vendorType,
      businessName: vendor.businessName,
      address: vendor.address,
      ownerFullName: vendor.ownerFullName,
      phone: vendor.phone,
      businessRegistrationType: vendor.businessRegistrationType,
      businessRegistrationNumber: vendor.businessRegistrationNumber,
      governmentIdNumber: vendor.governmentIdNumber,
    });

    const requiredDocs = [
      VendorDocumentType.GOVERNMENT_ID,
      VendorDocumentType.SELFIE_VERIFICATION,
    ];

    for (const requiredDoc of requiredDocs) {
      const hasRequiredDocument = await this.hasDocument(vendor.id, requiredDoc);
      if (!hasRequiredDocument) {
        throw new BadRequestException(`Missing required KYC document: ${requiredDoc}`);
      }
    }
  }

  private async syncRegistrationDocuments(vendorId: string, data: Record<string, any>) {
    const documentPayloads: Array<{
      type: VendorDocumentType;
      url: string | null;
      metadata?: Record<string, unknown>;
    }> = [
      {
        type: VendorDocumentType.GOVERNMENT_ID,
        url:
          this.normalizeText(data.governmentIdUrl) ||
          this.normalizeText(data.kycDocumentUrl),
      },
      {
        type: VendorDocumentType.SELFIE_VERIFICATION,
        url:
          this.normalizeText(data.selfieUrl) ||
          this.normalizeText(data.selfieVerificationUrl),
      },
      {
        type: VendorDocumentType.MAYORS_PERMIT,
        url: this.normalizeText(data.mayorsPermitUrl),
      },
      {
        type: VendorDocumentType.BARANGAY_PERMIT,
        url: this.normalizeText(data.barangayPermitUrl),
      },
      {
        type: VendorDocumentType.BUSINESS_LOGO,
        url: this.normalizeText(data.logoUrl),
      },
    ];

    for (const payload of documentPayloads) {
      if (!payload.url) continue;
      await this.ensureDocumentRecord(vendorId, payload.type, payload.url, payload.metadata);
    }
  }

  private async ensureDocumentRecord(
    vendorId: string,
    documentType: VendorDocumentType,
    fileUrl: string,
    metadata?: Record<string, unknown>,
  ) {
    const existing = await this.documentsRepo.findOne({
      where: { vendorId, documentType, fileUrl },
      order: { createdAt: 'DESC' },
    });
    if (existing) return existing;

    const document = this.documentsRepo.create({
      vendorId,
      documentType,
      fileUrl,
      fileHash: this.hashValue(fileUrl),
      metadata: metadata ? JSON.stringify(metadata) : null,
      status: VendorDocumentStatus.PENDING,
    });

    return this.documentsRepo.save(document);
  }

  private async getLatestVerifiedOtpChallenge(userId: string, channel: string) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.otpChallengesRepo
      .createQueryBuilder('otp')
      .where('otp.userId = :userId', { userId })
      .andWhere('otp.phone = :channel', { channel })
      .andWhere('otp.verifiedAt IS NOT NULL')
      .andWhere('otp.verifiedAt >= :cutoff', { cutoff })
      .orderBy('otp.verifiedAt', 'DESC')
      .getOne();
  }

  private async resolveOtpEmail(userId: string, emailInput?: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.email) {
      throw new NotFoundException('User email not found');
    }

    const accountEmail = this.normalizeEmail(user.email);
    const requestedEmail =
      emailInput === undefined ? accountEmail : this.normalizeEmail(emailInput);

    if (requestedEmail !== accountEmail) {
      throw new ForbiddenException('OTP can only be requested for your account email');
    }

    return accountEmail;
  }

  private async logVerificationStatus(
    vendorId: string,
    payload: {
      status: VendorVerificationStatus;
      actionType: VendorVerificationAction;
      reason?: string | null;
      riskScore?: number;
      duplicateSignals?: string[];
      reviewedByUserId?: string;
    },
  ) {
    const entry = this.verificationStatusRepo.create({
      vendorId,
      status: payload.status,
      actionType: payload.actionType,
      reason: this.normalizeText(payload.reason),
      riskScore: Number(payload.riskScore || 0),
      duplicateSignals:
        payload.duplicateSignals && payload.duplicateSignals.length
          ? JSON.stringify(payload.duplicateSignals)
          : null,
      reviewedByUserId: payload.reviewedByUserId || null,
    });

    return this.verificationStatusRepo.save(entry);
  }

  private async findByIdRaw(id: string, withKycDetails = false) {
    return this.vendorsRepo.findOne({
      where: { id },
      relations: withKycDetails
        ? [
            'user',
            'documents',
            'verificationHistory',
            'verificationItems',
            'verificationItems.photos',
          ]
        : ['user'],
    });
  }

  private async findByUserIdRaw(userId: string, withKycDetails = false) {
    return this.vendorsRepo.findOne({
      where: { userId },
      relations: withKycDetails
        ? [
            'user',
            'documents',
            'verificationHistory',
            'verificationItems',
            'verificationItems.photos',
          ]
        : ['user'],
    });
  }
}
