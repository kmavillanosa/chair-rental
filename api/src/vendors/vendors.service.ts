import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import {
  BusinessRegistrationType,
  Vendor,
  VendorKycStatus,
  VendorPaymentMode,
  VendorRegistrationStatus,
  VendorType,
  VendorVerificationStatus,
} from './entities/vendor.entity';
import { CustomerFavoriteVendor } from './entities/customer-favorite-vendor.entity';
import { VendorReview } from './entities/vendor-review.entity';
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
import { BookingReview } from '../bookings/entities/booking-review.entity';
import { EmailService } from '../common/email.service';
import { SettingsService } from '../settings/settings.service';
import { PricingConfigBootstrapService } from '../payments/services/pricing-config-bootstrap.service';

type JsonRecord = Record<string, any>;

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);
  private readonly emailOtpChannel = '__email__';
  private readonly vendorGalleryPhotoLimit = 10;

  constructor(
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
    @InjectRepository(CustomerFavoriteVendor)
    private readonly customerFavoriteVendorsRepo: Repository<CustomerFavoriteVendor>,
    @InjectRepository(VendorReview)
    private readonly vendorReviewsRepo: Repository<VendorReview>,
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
    @InjectRepository(BookingReview)
    private readonly bookingReviewsRepo: Repository<BookingReview>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
    private readonly pricingBootstrapService: PricingConfigBootstrapService,
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

  async listFavoriteVendorIdsForCustomer(customerUserId: string) {
    const favorites = await this.customerFavoriteVendorsRepo.find({
      where: { customerUserId },
      order: { createdAt: 'DESC' },
    });

    return favorites.map((favorite) => favorite.vendorId);
  }

  async addFavoriteVendorForCustomer(customerUserId: string, vendorId: string) {
    const vendor = await this.vendorsRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Rental partner not found');
    }

    const existingFavorite = await this.customerFavoriteVendorsRepo.findOne({
      where: { customerUserId, vendorId },
    });
    if (existingFavorite) {
      return { vendorId, isFavorite: true };
    }

    const favorite = this.customerFavoriteVendorsRepo.create({
      customerUserId,
      vendorId,
    });
    await this.customerFavoriteVendorsRepo.save(favorite);

    return { vendorId, isFavorite: true };
  }

  async removeFavoriteVendorForCustomer(customerUserId: string, vendorId: string) {
    await this.customerFavoriteVendorsRepo.delete({ customerUserId, vendorId });
    return { vendorId, isFavorite: false };
  }

  async listVendorReviews(vendorId: string) {
    const vendor = await this.vendorsRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Rental partner not found');
    }

    return this.vendorReviewsRepo.find({
      where: { vendorId },
      relations: ['reviewerUser'],
      order: { updatedAt: 'DESC' },
    });
  }

  async submitVendorReview(
    vendorId: string,
    reviewerUserId: string,
    ratingInput: number,
    commentInput?: string,
  ) {
    const vendor = await this.vendorsRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Rental partner not found');
    }

    const rating = Math.round(Number(ratingInput));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    const comment = String(commentInput || '').trim() || null;

    const existingReview = await this.vendorReviewsRepo.findOne({
      where: { vendorId, reviewerUserId },
    });

    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment;
      await this.vendorReviewsRepo.save(existingReview);
    } else {
      await this.vendorReviewsRepo.save(
        this.vendorReviewsRepo.create({
          vendorId,
          reviewerUserId,
          rating,
          comment,
        }),
      );
    }

    await this.refreshVendorRatingSummary(vendor.id, vendor.userId);
    return this.listVendorReviews(vendorId);
  }

  async findBySlug(slug: string) {
    const vendor = await this.vendorsRepo.findOne({
      where: { slug },
      relations: ['user'],
    });
    return this.withVerificationBadge(vendor);
  }

  async listPublicDirectory() {
    let includeTestVendors = false;

    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();
      includeTestVendors = Boolean(flags.showTestVendorsOnCustomerMap);
    } catch {
      includeTestVendors = false;
    }

    const visibilityFilter = {
      isActive: true,
      isVerified: true,
      ...(includeTestVendors ? {} : { isTestAccount: false }),
    };

    const vendors = await this.vendorsRepo.find({
      where: [
        {
          ...visibilityFilter,
          verificationStatus: In([
            VendorVerificationStatus.VERIFIED_BUSINESS,
            VendorVerificationStatus.VERIFIED_OWNER,
          ]),
        },
        {
          ...visibilityFilter,
          registrationStatus: VendorRegistrationStatus.APPROVED,
        },
      ],
      relations: ['user'],
      order: { businessName: 'ASC' },
    });

    return vendors.map((vendor) => this.withVerificationBadge(vendor));
  }

  async isSlugAvailable(slug: string, excludeId?: string) {
    const normalized = this.normalizeSlug(String(slug || ''));
    if (!normalized) return { available: false, slug: normalized };
    const existing = await this.vendorsRepo.findOne({ where: { slug: normalized } });
    const available = !existing || (!!excludeId && existing.id === excludeId);
    return { available, slug: normalized };
  }

  async findByUserId(userId: string, withKycDetails = false) {
    const vendor = await this.findByUserIdRaw(userId, withKycDetails);
    return this.withVerificationBadge(vendor);
  }

  async create(data: Partial<Vendor> & { userEmail?: string; email?: string }) {
    const {
      userEmail,
      email,
      bankAccountNumber: bankAccountNumberInput,
      ...vendorInput
    } = data as any;
    const requestedUserId = this.normalizeText(vendorInput.userId);
    const requestedUserEmail = this.normalizeText(userEmail || email);

    let resolvedUserId = requestedUserId;
    if (!resolvedUserId && requestedUserEmail) {
      const user = await this.usersService.findByEmail(requestedUserEmail);
      if (!user) {
        throw new BadRequestException(
          `No user account found for ${requestedUserEmail}`,
        );
      }
      resolvedUserId = user.id;
    }

    if (!resolvedUserId) {
      throw new BadRequestException('userId or userEmail is required');
    }

    const ownerUser = await this.usersService.findById(resolvedUserId);
    if (!ownerUser) {
      throw new BadRequestException('Selected user does not exist');
    }

    const existingVendorForUser = await this.vendorsRepo.findOne({
      where: { userId: resolvedUserId },
    });
    if (existingVendorForUser) {
      throw new BadRequestException('Selected user already has a vendor profile');
    }

    const normalizedVendorType = this.normalizeVendorType(data.vendorType);
    const verificationStatus =
      this.normalizeVerificationStatus(data.verificationStatus) ||
      (data.isVerified
        ? this.mapVendorTypeToVerifiedStatus(normalizedVendorType)
        : VendorVerificationStatus.PENDING_VERIFICATION);

    const bankName = this.normalizeText(vendorInput.bankName);
    const bankAccountName = this.normalizeText(vendorInput.bankAccountName);
    const bankAccountNumber = this.normalizeBankAccountNumber(
      bankAccountNumberInput,
    );
    const bankAccountStorage = bankAccountNumber
      ? this.buildBankAccountStorage(bankAccountNumber)
      : null;

    if (
      (bankName || bankAccountName || bankAccountStorage) &&
      (!bankName || !bankAccountName || !bankAccountStorage)
    ) {
      throw new BadRequestException(
        'Complete payout account details are required: payout method, account name, and account number',
      );
    }

    const vendorData: Partial<Vendor> = {
      ...vendorInput,
      userId: resolvedUserId,
      vendorType: normalizedVendorType,
      businessRegistrationType: this.normalizeBusinessRegistrationType(
        vendorInput.businessRegistrationType,
      ),
      businessRegistrationNumber: this.normalizeIdentifier(
        vendorInput.businessRegistrationNumber,
      ),
      birTin: this.normalizeTin(vendorInput.birTin),
      ownerFullName: this.normalizeText(vendorInput.ownerFullName),
      governmentIdNumber: this.normalizeIdentifier(vendorInput.governmentIdNumber),
      phone: this.normalizePhone(vendorInput.phone),
      socialMediaLink: this.normalizeText(vendorInput.socialMediaLink),
      bankName,
      bankAccountName,
      bankAccountNumberMasked: bankAccountStorage?.masked || null,
      bankAccountLast4: bankAccountStorage?.last4 || null,
      bankAccountHash: bankAccountStorage?.hash || null,
      registrationStatus:
        vendorInput.registrationStatus || VendorRegistrationStatus.APPROVED,
      kycStatus: vendorInput.kycStatus || VendorKycStatus.APPROVED,
      verificationStatus,
      verificationBadge: this.getVerificationBadgeLabel(verificationStatus),
      isVerified: vendorInput.isVerified ?? true,
      isActive: vendorInput.isActive ?? true,
      duplicateRiskScore: Number(vendorInput.duplicateRiskScore || 0),
      paymongoMerchantId: this.normalizePaymongoMerchantId(vendorInput.paymongoMerchantId),
    };

    if (!vendorData.businessName && vendorData.ownerFullName) {
      vendorData.businessName = `${vendorData.ownerFullName} Rentals`;
    }

    if (!vendorData.slug && vendorData.businessName) {
      vendorData.slug = await this.ensureSlugAvailable(vendorData.businessName);
    }

    const vendor = this.vendorsRepo.create(vendorData);
    const saved = await this.vendorsRepo.save(vendor);

    if (vendorData.isVerified) {
      await this.usersService.updateRole(resolvedUserId, UserRole.VENDOR);
    }

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
    const bankName = this.normalizeText(
      data.bankName || data.payoutMethod || data.payoutChannel,
    );
    const bankAccountName = this.normalizeText(
      data.bankAccountName || data.payoutAccountName,
    );
    const bankAccountNumber = this.normalizeBankAccountNumber(
      data.bankAccountNumber || data.payoutAccountNumber || data.gcashNumber,
    );

    const existing = await this.findByUserIdRaw(userId, true);
    const bankAccountStorage = bankAccountNumber
      ? this.buildBankAccountStorage(bankAccountNumber)
      : null;
    const resolvedBankName = bankName || existing?.bankName || null;
    const resolvedBankAccountName =
      bankAccountName || existing?.bankAccountName || null;
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
      bankName,
      bankAccountName,
      bankAccountNumber,
      hasStoredBankAccount: Boolean(existing?.bankAccountHash),
      hasStoredBankName: Boolean(existing?.bankName),
      hasStoredBankAccountName: Boolean(existing?.bankAccountName),
    });

    const kycSettings = await this.settingsService.getKycSettings();
    if (!kycSettings.vendorRegistrationEnabled) {
      throw new BadRequestException(
        'Vendor registration is currently disabled by platform settings',
      );
    }

    let otpChallenge: VendorPhoneOtpChallenge | null = null;
    if (kycSettings.requireOtpBeforeVendorRegistration) {
      otpChallenge = await this.getLatestVerifiedOtpChallenge(
        userId,
        this.emailOtpChannel,
      );
      if (!otpChallenge) {
        throw new BadRequestException(
          'Email OTP verification is required before vendor registration',
        );
      }
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

    const explicitSlug = this.normalizeText(data.slug);
    let slug: string;
    if (explicitSlug) {
      const normalizedExplicitSlug = this.normalizeSlug(explicitSlug);
      if (!normalizedExplicitSlug) {
        throw new BadRequestException('Store web address is invalid');
      }

      const availability = await this.isSlugAvailable(
        normalizedExplicitSlug,
        existing?.id,
      );
      if (!availability.available) {
        throw new BadRequestException('Store web address is already taken');
      }

      slug = availability.slug;
    } else {
      const slugSeed = businessName || `vendor-${userId.slice(0, 8)}`;
      slug = await this.ensureSlugAvailable(slugSeed, existing?.id);
    }

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
      phoneOtpVerifiedAt:
        otpChallenge?.verifiedAt || existing?.phoneOtpVerifiedAt || null,
      socialMediaLink: this.normalizeText(data.socialMediaLink),
      bankName: resolvedBankName,
      bankAccountName: resolvedBankAccountName,
      bankAccountNumberMasked:
        bankAccountStorage?.masked || existing?.bankAccountNumberMasked || null,
      bankAccountLast4: bankAccountStorage?.last4 || existing?.bankAccountLast4 || null,
      bankAccountHash: bankAccountStorage?.hash || existing?.bankAccountHash || null,
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
    const existing = await this.findByIdRaw(id, false);
    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    const {
      bankName: bankNameInput,
      bankAccountName: bankAccountNameInput,
      bankAccountNumber: bankAccountNumberInput,
      ...safeData
    } = data as any;

    const payload: Partial<Vendor> = {
      ...safeData,
    };

    if (Object.prototype.hasOwnProperty.call(safeData, 'vendorType')) {
      payload.vendorType = this.normalizeVendorType(safeData.vendorType);
    }
    if (Object.prototype.hasOwnProperty.call(safeData, 'businessRegistrationType')) {
      payload.businessRegistrationType = this.normalizeBusinessRegistrationType(
        safeData.businessRegistrationType,
      );
    }
    if (Object.prototype.hasOwnProperty.call(safeData, 'businessRegistrationNumber')) {
      payload.businessRegistrationNumber = this.normalizeIdentifier(
        safeData.businessRegistrationNumber,
      );
    }
    if (Object.prototype.hasOwnProperty.call(safeData, 'birTin')) {
      payload.birTin = this.normalizeTin(safeData.birTin);
    }
    if (Object.prototype.hasOwnProperty.call(safeData, 'ownerFullName')) {
      payload.ownerFullName = this.normalizeText(safeData.ownerFullName);
    }
    if (Object.prototype.hasOwnProperty.call(safeData, 'governmentIdNumber')) {
      payload.governmentIdNumber = this.normalizeIdentifier(
        safeData.governmentIdNumber,
      );
    }
    if (Object.prototype.hasOwnProperty.call(safeData, 'phone')) {
      payload.phone = this.normalizePhone(safeData.phone);
    }
    if (Object.prototype.hasOwnProperty.call(safeData, 'socialMediaLink')) {
      payload.socialMediaLink = this.normalizeText(safeData.socialMediaLink);
    }

    const hasBankNameInput = Object.prototype.hasOwnProperty.call(data, 'bankName');
    const hasBankAccountNameInput = Object.prototype.hasOwnProperty.call(
      data,
      'bankAccountName',
    );
    const hasBankAccountNumberInput = Object.prototype.hasOwnProperty.call(
      data,
      'bankAccountNumber',
    );

    const nextBankName = hasBankNameInput
      ? this.normalizeText(bankNameInput)
      : existing.bankName;
    const nextBankAccountName = hasBankAccountNameInput
      ? this.normalizeText(bankAccountNameInput)
      : existing.bankAccountName;
    const nextBankAccountNumber = hasBankAccountNumberInput
      ? this.normalizeBankAccountNumber(bankAccountNumberInput)
      : null;
    const nextBankAccountStorage = nextBankAccountNumber
      ? this.buildBankAccountStorage(nextBankAccountNumber)
      : null;
    const nextBankAccountHash = hasBankAccountNumberInput
      ? nextBankAccountStorage?.hash || null
      : existing.bankAccountHash;

    const payoutInputTouched =
      hasBankNameInput || hasBankAccountNameInput || hasBankAccountNumberInput;
    if (
      payoutInputTouched &&
      (nextBankName || nextBankAccountName || nextBankAccountHash) &&
      (!nextBankName || !nextBankAccountName || !nextBankAccountHash)
    ) {
      throw new BadRequestException(
        'Complete payout account details are required: payout method, account name, and account number',
      );
    }

    if (hasBankNameInput) {
      payload.bankName = nextBankName;
    }
    if (hasBankAccountNameInput) {
      payload.bankAccountName = nextBankAccountName;
    }
    if (hasBankAccountNumberInput) {
      payload.bankAccountNumberMasked = nextBankAccountStorage?.masked || null;
      payload.bankAccountLast4 = nextBankAccountStorage?.last4 || null;
      payload.bankAccountHash = nextBankAccountStorage?.hash || null;
    }

    // Normalise paymongoMerchantId: trim whitespace, validate org_ prefix,
    // allow explicit null to clear the value.
    if (Object.prototype.hasOwnProperty.call(data, 'paymongoMerchantId')) {
      const raw = (data as any).paymongoMerchantId;
      if (raw === null || raw === undefined || String(raw).trim() === '') {
        payload.paymongoMerchantId = null;
      } else {
        const trimmed = String(raw).trim();
        if (!/^org_[A-Za-z0-9]{10,}$/.test(trimmed)) {
          throw new BadRequestException(
            'paymongoMerchantId must be a valid PayMongo organisation ID (e.g. org_xxxxxxxxxxxx)',
          );
        }
        payload.paymongoMerchantId = trimmed;
      }
    }

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

      // Bootstrap pricing configuration for vendor
      try {
        await this.pricingBootstrapService.bootstrapPricingConfigForVendor(id);
      } catch (error) {
        this.logger.error(
          `Failed to bootstrap pricing config for vendor ${id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        // Don't fail the whole approval process if pricing bootstrap fails
      }
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
  }

  // ── Vendor payment-mode settings ──────────────────────────────────────────

  async getMyPaymentSettings(userId: string) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    return {
      paymentMode: vendor.paymentMode || VendorPaymentMode.FULL_PAYMENT,
      downpaymentPercent: Number(vendor.downpaymentPercent ?? 30),
    };
  }

  async updateMyPaymentSettings(
    userId: string,
    data: { paymentMode?: string; downpaymentPercent?: number },
  ) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    const validModes = Object.values(VendorPaymentMode) as string[];
    if (data.paymentMode !== undefined && !validModes.includes(data.paymentMode)) {
      throw new BadRequestException(
        `paymentMode must be one of: ${validModes.join(', ')}`,
      );
    }

    if (data.downpaymentPercent !== undefined) {
      const pct = Number(data.downpaymentPercent);
      if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
        throw new BadRequestException(
          'downpaymentPercent must be a number between 1 and 99',
        );
      }
    }

    const updates: Partial<Vendor> = {};
    if (data.paymentMode !== undefined) {
      updates.paymentMode = data.paymentMode as VendorPaymentMode;
    }
    if (data.downpaymentPercent !== undefined) {
      updates.downpaymentPercent = Number(
        Number(data.downpaymentPercent).toFixed(2),
      );
    }

    if (Object.keys(updates).length > 0) {
      await this.vendorsRepo.update(vendor.id, updates);
    }

    return this.getMyPaymentSettings(userId);
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

    const normalizedMetadata = this.normalizeVendorItemPhotoMetadata(metadata);
    const isGalleryUpload = this.isGalleryPhotoMetadata(normalizedMetadata);

    if (isGalleryUpload) {
      const existingPhotos = await this.vendorItemPhotosRepo.find({
        where: { vendorItemId },
      });
      const galleryPhotoCount = existingPhotos.filter((itemPhoto) =>
        this.isGalleryVendorItemPhoto(itemPhoto),
      ).length;

      if (galleryPhotoCount >= this.vendorGalleryPhotoLimit) {
        throw new BadRequestException(
          `Gallery limit reached. You can only upload up to ${this.vendorGalleryPhotoLimit} images.`,
        );
      }
    }

    const photo = this.vendorItemPhotosRepo.create({
      vendorItemId,
      photoType,
      fileUrl,
      metadata: normalizedMetadata ? JSON.stringify(normalizedMetadata) : null,
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

  async deleteVendorItemPhoto(
    userId: string,
    vendorItemId: string,
    photoId: string,
  ) {
    const vendor = await this.findByUserIdRaw(userId, false);
    if (!vendor) throw new NotFoundException('Vendor profile not found');

    const vendorItem = await this.vendorItemsRepo.findOne({
      where: { id: vendorItemId },
    });
    if (!vendorItem) throw new NotFoundException('Vendor item not found');
    if (vendorItem.vendorId !== vendor.id) {
      throw new ForbiddenException('You can only delete photos for your own vendor items');
    }

    const photo = await this.vendorItemPhotosRepo.findOne({
      where: { id: photoId, vendorItemId },
    });
    if (!photo) throw new NotFoundException('Vendor item photo not found');

    await this.vendorItemPhotosRepo.delete({ id: photoId, vendorItemId });

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
    let includeTestVendors = false;

    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();
      includeTestVendors = Boolean(flags.showTestVendorsOnCustomerMap);
    } catch {
      includeTestVendors = false;
    }

    const nearbyBaseVisibilityFilter = {
      isActive: true,
      isVerified: true,
      ...(includeTestVendors ? {} : { isTestAccount: false }),
    };

    const vendors = await this.vendorsRepo.find({
      where: [
        {
          ...nearbyBaseVisibilityFilter,
          verificationStatus: In([
            VendorVerificationStatus.VERIFIED_BUSINESS,
            VendorVerificationStatus.VERIFIED_OWNER,
          ]),
        },
        {
          ...nearbyBaseVisibilityFilter,
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

    const vendorCoordinates = vendors
      .map((vendor) => {
        const vendorLat = Number(vendor.latitude);
        const vendorLng = Number(vendor.longitude);
        if (!Number.isFinite(vendorLat) || !Number.isFinite(vendorLng)) {
          return null;
        }

        return {
          id: vendor.id,
          lat: vendorLat,
          lng: vendorLng,
        };
      })
      .filter(
        (
          coordinate,
        ): coordinate is { id: string; lat: number; lng: number } =>
          Boolean(coordinate),
      );

    const roadDistanceKmByVendorId = await this.getRoadDistanceKmByVendorId(
      lat,
      lng,
      vendorCoordinates,
    );

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

        const straightLineDistanceKm = this.haversine(
          lat,
          lng,
          vendorLat,
          vendorLng,
        );
        if (!Number.isFinite(straightLineDistanceKm)) return null;

        const distanceKm =
          roadDistanceKmByVendorId.get(vendor.id) ?? straightLineDistanceKm;

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

  private async getRoadDistanceKmByVendorId(
    originLat: number,
    originLng: number,
    destinations: Array<{ id: string; lat: number; lng: number }>,
  ) {
    const distanceMap = new Map<string, number>();
    if (!destinations.length) return distanceMap;

    // Keep tests deterministic and avoid external API calls while running CI.
    if (process.env.NODE_ENV === 'test') return distanceMap;

    const maxDestinationsPerRequest = 80;

    for (
      let offset = 0;
      offset < destinations.length;
      offset += maxDestinationsPerRequest
    ) {
      const batch = destinations.slice(offset, offset + maxDestinationsPerRequest);
      const coordinates = [
        `${originLng},${originLat}`,
        ...batch.map((destination) => `${destination.lng},${destination.lat}`),
      ];

      try {
        const url = new URL(
          `https://router.project-osrm.org/table/v1/driving/${coordinates.join(';')}`,
        );
        url.searchParams.set('sources', '0');
        url.searchParams.set('annotations', 'distance');

        const response = await fetch(url.toString());
        if (!response.ok) continue;

        const payload = (await response.json()) as {
          distances?: Array<Array<number | null>>;
        };

        const row = payload.distances?.[0];
        if (!Array.isArray(row)) continue;

        for (let index = 0; index < batch.length; index += 1) {
          const meters = Number(row[index + 1]);
          if (!Number.isFinite(meters) || meters < 0) continue;
          distanceMap.set(batch[index].id, meters / 1000);
        }
      } catch {
        // Ignore route service failures and let caller fall back to haversine.
      }
    }

    return distanceMap;
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

  async resetWarnings(id: string, reviewedByUserId?: string) {
    const vendor = await this.findByIdRaw(id, false);
    if (!vendor) throw new NotFoundException('Vendor not found');

    await this.vendorsRepo.update(id, {
      warningCount: 0,
    });

    await this.logVerificationStatus(id, {
      status:
        vendor.verificationStatus ||
        VendorVerificationStatus.PENDING_VERIFICATION,
      actionType: VendorVerificationAction.WARNING_RESET,
      reason: 'Vendor warnings cleared by admin',
      reviewedByUserId,
    });

    return this.findById(id, true);
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

  async hardDeleteVendor(id: string, deletedByUserId?: string) {
    const vendor = await this.findByIdRaw(id, true);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const userId = vendor.userId;

    const deletedCounts = await this.dataSource.transaction(async (manager) => {
      const bookingRows = await manager
        .createQueryBuilder(Booking, 'booking')
        .select('booking.id', 'id')
        .where('booking.vendorId = :vendorId', { vendorId: id })
        .getRawMany<{ id: string }>();
      const bookingIds = bookingRows.map((row) => row.id);

      const inventoryRows = await manager
        .createQueryBuilder(InventoryItem, 'inventoryItem')
        .select('inventoryItem.id', 'id')
        .where('inventoryItem.vendorId = :vendorId', { vendorId: id })
        .getRawMany<{ id: string }>();
      const inventoryItemIds = inventoryRows.map((row) => row.id);

      const vendorItemRows = await manager
        .createQueryBuilder(VendorItem, 'vendorItem')
        .select('vendorItem.id', 'id')
        .where('vendorItem.vendorId = :vendorId', { vendorId: id })
        .getRawMany<{ id: string }>();
      const vendorItemIds = vendorItemRows.map((row) => row.id);

      const disputeIds = bookingIds.length
        ? (
            await manager
              .createQueryBuilder()
              .from('booking_disputes', 'bookingDispute')
              .select('bookingDispute.id', 'id')
              .where('bookingDispute.bookingId IN (:...bookingIds)', {
                bookingIds,
              })
              .getRawMany<{ id: string }>()
          ).map((row) => row.id)
        : [];

      const deleteWhereEquals = async (
        tableName: string,
        column: string,
        value: string,
      ): Promise<number> => {
        const result = await manager
          .createQueryBuilder()
          .delete()
          .from(tableName)
          .where(`${column} = :value`, { value })
          .execute();
        return result.affected || 0;
      };

      const deleteWhereIn = async (
        tableName: string,
        column: string,
        values: string[],
      ): Promise<number> => {
        if (!values.length) return 0;
        const result = await manager
          .createQueryBuilder()
          .delete()
          .from(tableName)
          .where(`${column} IN (:...values)`, { values })
          .execute();
        return result.affected || 0;
      };

      const deletedFraudAlerts = bookingIds.length
        ? (
            await manager
              .createQueryBuilder()
              .delete()
              .from('fraud_alerts')
              .where('vendorId = :vendorId', { vendorId: id })
              .orWhere('bookingId IN (:...bookingIds)', { bookingIds })
              .execute()
          ).affected || 0
        : await deleteWhereEquals('fraud_alerts', 'vendorId', id);

      const deletedDisputeEvidence = disputeIds.length
        ? await deleteWhereIn('booking_dispute_evidence', 'disputeId', disputeIds)
        : 0;

      const deletedDisputes = bookingIds.length
        ? await deleteWhereIn('booking_disputes', 'bookingId', bookingIds)
        : 0;

      const deletedPayouts = bookingIds.length
        ? (
            await manager
              .createQueryBuilder()
              .delete()
              .from('vendor_payouts')
              .where('vendorId = :vendorId', { vendorId: id })
              .orWhere('bookingId IN (:...bookingIds)', { bookingIds })
              .execute()
          ).affected || 0
        : await deleteWhereEquals('vendor_payouts', 'vendorId', id);

      const deletedBookingDocuments = bookingIds.length
        ? await deleteWhereIn('booking_documents', 'bookingId', bookingIds)
        : 0;

      const deletedDeliveryProofs = bookingIds.length
        ? (
            await manager
              .createQueryBuilder()
              .delete()
              .from('booking_delivery_proofs')
              .where('vendorId = :vendorId', { vendorId: id })
              .orWhere('bookingId IN (:...bookingIds)', { bookingIds })
              .execute()
          ).affected || 0
        : await deleteWhereEquals('booking_delivery_proofs', 'vendorId', id);

      const deletedBookingMessages = bookingIds.length
        ? await deleteWhereIn('booking_messages', 'bookingId', bookingIds)
        : 0;

      const deletedBookingReviews = bookingIds.length
        ? await deleteWhereIn('booking_reviews', 'bookingId', bookingIds)
        : 0;

      const deletedBookingItemsByBooking = bookingIds.length
        ? await deleteWhereIn('booking_items', 'bookingId', bookingIds)
        : 0;

      const deletedBookings = await deleteWhereEquals('bookings', 'vendorId', id);

      const deletedBookingItemsByInventory = inventoryItemIds.length
        ? await deleteWhereIn('booking_items', 'inventoryItemId', inventoryItemIds)
        : 0;

      const deletedVendorItemPhotos = vendorItemIds.length
        ? await deleteWhereIn('vendor_item_photos', 'vendorItemId', vendorItemIds)
        : 0;

      const deletedVendorItems = await deleteWhereEquals('vendor_items', 'vendorId', id);
      const deletedInventoryItems = await deleteWhereEquals('inventory_items', 'vendorId', id);
      const deletedDeliveryRates = await deleteWhereEquals('delivery_rates', 'vendorId', id);
      const deletedVendorPayments = await deleteWhereEquals('vendor_payments', 'vendorId', id);
      const deletedVendorDocuments = await deleteWhereEquals('vendor_documents', 'vendorId', id);
      const deletedVerificationHistory = await deleteWhereEquals('vendor_verification_status', 'vendorId', id);
      const deletedOtpChallenges = userId
        ? await deleteWhereEquals('vendor_phone_otp_challenges', 'userId', userId)
        : 0;
      const deletedVendor = await deleteWhereEquals('vendors', 'id', id);

      if (userId) {
        await manager
          .createQueryBuilder()
          .update('users')
          .set({ role: UserRole.CUSTOMER })
          .where('id = :userId', { userId })
          .andWhere('role = :vendorRole', { vendorRole: UserRole.VENDOR })
          .execute();
      }

      return {
        bookingDisputeEvidence: deletedDisputeEvidence,
        bookingDisputes: deletedDisputes,
        fraudAlerts: deletedFraudAlerts,
        vendorPayouts: deletedPayouts,
        bookingDocuments: deletedBookingDocuments,
        bookingDeliveryProofs: deletedDeliveryProofs,
        bookingMessages: deletedBookingMessages,
        bookingReviews: deletedBookingReviews,
        bookingItemsByBooking: deletedBookingItemsByBooking,
        bookings: deletedBookings,
        bookingItemsByInventory: deletedBookingItemsByInventory,
        vendorItemPhotos: deletedVendorItemPhotos,
        vendorItems: deletedVendorItems,
        inventoryItems: deletedInventoryItems,
        deliveryRates: deletedDeliveryRates,
        vendorPayments: deletedVendorPayments,
        vendorDocuments: deletedVendorDocuments,
        vendorVerificationStatusEntries: deletedVerificationHistory,
        vendorOtpChallenges: deletedOtpChallenges,
        vendor: deletedVendor,
      };
    });

    this.logger.warn(
      `Hard-deleted vendor ${id} by admin ${deletedByUserId || 'unknown-admin'}`,
    );

    return {
      vendorId: id,
      userId,
      deletedByUserId: deletedByUserId || null,
      deletedCounts,
    };
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
    const updatePayload: Partial<Vendor> = {
      isActive,
      suspendedUntil: isActive ? null : vendor.suspendedUntil,
      kycNotes: normalizedReason || vendor.kycNotes,
    };

    let statusForAudit =
      this.normalizeVerificationStatus(vendor.verificationStatus) ||
      VendorVerificationStatus.PENDING_VERIFICATION;

    if (isActive) {
      const normalizedCurrentStatus = this.normalizeVerificationStatus(
        vendor.verificationStatus,
      );
      const hasApprovedVisibilityState =
        vendor.isVerified &&
        (normalizedCurrentStatus === VendorVerificationStatus.VERIFIED_BUSINESS ||
          normalizedCurrentStatus === VendorVerificationStatus.VERIFIED_OWNER ||
          vendor.registrationStatus === VendorRegistrationStatus.APPROVED);

      if (!hasApprovedVisibilityState) {
        const latestApprovedEntry = await this.verificationStatusRepo.findOne({
          where: {
            vendorId: id,
            status: In([
              VendorVerificationStatus.VERIFIED_BUSINESS,
              VendorVerificationStatus.VERIFIED_OWNER,
            ]),
          },
          order: { createdAt: 'DESC' },
        });

        if (latestApprovedEntry) {
          statusForAudit = latestApprovedEntry.status;
          updatePayload.isVerified = true;
          updatePayload.registrationStatus = VendorRegistrationStatus.APPROVED;
          updatePayload.kycStatus = VendorKycStatus.APPROVED;
          updatePayload.verificationStatus = latestApprovedEntry.status;
          updatePayload.verificationBadge = this.getVerificationBadgeLabel(
            latestApprovedEntry.status,
          );
          updatePayload.rejectionReason = null;
          updatePayload.reviewedAt = new Date();
          updatePayload.reviewedByUserId = reviewedByUserId || null;

          await this.usersService.updateRole(vendor.userId, UserRole.VENDOR);
        }
      }
    }

    await this.vendorsRepo.update(id, updatePayload);

    await this.logVerificationStatus(id, {
      status: statusForAudit,
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

  async setTestAccount(
    id: string,
    isTestAccount: boolean,
    reviewedByUserId?: string,
  ) {
    const vendor = await this.findByIdRaw(id, false);
    if (!vendor) throw new NotFoundException('Vendor not found');

    await this.vendorsRepo.update(id, {
      isTestAccount: Boolean(isTestAccount),
    });

    await this.logVerificationStatus(id, {
      status:
        this.normalizeVerificationStatus(vendor.verificationStatus) ||
        VendorVerificationStatus.PENDING_VERIFICATION,
      actionType: VendorVerificationAction.FLAGGED,
      reason: isTestAccount
        ? 'Vendor flagged as test account by admin'
        : 'Vendor removed from test account list by admin',
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

  private async refreshVendorRatingSummary(vendorId: string, vendorUserId: string) {
    const [bookingReviews, vendorReviews] = await Promise.all([
      this.bookingReviewsRepo.find({
        where: {
          revieweeUserId: vendorUserId,
          revieweeRole: UserRole.VENDOR,
        },
      }),
      this.vendorReviewsRepo.find({ where: { vendorId } }),
    ]);

    const ratings = [
      ...bookingReviews.map((review) => Number(review.rating || 0)),
      ...vendorReviews.map((review) => Number(review.rating || 0)),
    ];
    const totalRatings = ratings.length;
    const averageRating = totalRatings
      ? Number(
          (
            ratings.reduce((sum, rating) => sum + rating, 0) / totalRatings
          ).toFixed(2),
        )
      : 0;

    await this.vendorsRepo.update(vendorId, {
      averageRating,
      totalRatings,
      lowRatingFlag: totalRatings >= 3 && averageRating < 3,
    });
  }

  /** Trims and validates a PayMongo organisation merchant ID (must start with org_ and be at least 14 chars). */
  private normalizePaymongoMerchantId(input: unknown): string | null {
    if (input === null || input === undefined) return null;
    const trimmed = String(input).trim();
    if (!trimmed) return null;
    if (!/^org_[A-Za-z0-9]{10,}$/.test(trimmed)) {
      throw new BadRequestException(
        'paymongoMerchantId must be a valid PayMongo organisation ID (e.g. org_xxxxxxxxxxxx)',
      );
    }
    return trimmed;
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

  private normalizeBankAccountNumber(input: unknown): string | null {
    const normalized = String(input || '').trim();
    if (!normalized) return null;

    const digitsOnly = normalized.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      throw new BadRequestException(
        'Payout account number must contain numeric digits',
      );
    }

    if (digitsOnly.length < 8 || digitsOnly.length > 32) {
      throw new BadRequestException(
        'Payout account number must be between 8 and 32 digits',
      );
    }

    return digitsOnly;
  }

  private buildBankAccountStorage(accountNumber: string) {
    const normalized = this.normalizeBankAccountNumber(accountNumber);
    if (!normalized) {
      throw new BadRequestException('Payout account number is required');
    }

    const last4 = normalized.slice(-4);
    return {
      masked: `${'*'.repeat(Math.max(normalized.length - 4, 0))}${last4}`,
      last4,
      hash: this.hashValue(`bank-account::${normalized}`),
    };
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

  private normalizeVendorItemPhotoMetadata(input?: Record<string, unknown>) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return undefined;
    }

    return input;
  }

  private parseVendorItemPhotoMetadata(input: unknown): JsonRecord | null {
    if (input === undefined || input === null) {
      return null;
    }

    if (typeof input === 'string') {
      const normalized = input.trim();
      if (!normalized) {
        return null;
      }

      try {
        const parsed = JSON.parse(normalized);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as JsonRecord;
        }
      } catch {
        return null;
      }

      return null;
    }

    if (typeof input === 'object' && !Array.isArray(input)) {
      return input as JsonRecord;
    }

    return null;
  }

  private isGalleryPhotoMetadata(metadata?: Record<string, unknown> | null) {
    if (!metadata) {
      return false;
    }

    return String(metadata.category || '').trim().toLowerCase() === 'gallery';
  }

  private isGalleryVendorItemPhoto(photo: Pick<VendorItemPhoto, 'metadata'>) {
    const metadata = this.parseVendorItemPhotoMetadata(photo.metadata);
    return this.isGalleryPhotoMetadata(metadata);
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

  private parseBooleanFlag(input: unknown) {
    const normalized = String(input || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
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
    bankName?: string | null;
    bankAccountName?: string | null;
    bankAccountNumber?: string | null;
    hasStoredBankAccount?: boolean;
    hasStoredBankName?: boolean;
    hasStoredBankAccountName?: boolean;
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

    const hasPayoutMethod = Boolean(payload.bankName || payload.hasStoredBankName);
    const hasPayoutAccountName = Boolean(
      payload.bankAccountName || payload.hasStoredBankAccountName,
    );
    const hasPayoutAccountNumber = Boolean(
      payload.bankAccountNumber || payload.hasStoredBankAccount,
    );

    if (!hasPayoutMethod) {
      throw new BadRequestException('Payout method (bank or e-wallet) is required');
    }

    if (!hasPayoutAccountName) {
      throw new BadRequestException('Payout account name is required');
    }

    if (!hasPayoutAccountNumber) {
      throw new BadRequestException('Payout account number is required');
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
    const kycSettings = await this.settingsService.getKycSettings();
    if (kycSettings.requireOtpBeforeVendorRegistration && !vendor.phoneOtpVerifiedAt) {
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
      bankName: vendor.bankName,
      bankAccountName: vendor.bankAccountName,
      hasStoredBankAccount: Boolean(vendor.bankAccountHash),
      hasStoredBankName: Boolean(vendor.bankName),
      hasStoredBankAccountName: Boolean(vendor.bankAccountName),
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