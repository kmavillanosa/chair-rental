import { BadRequestException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const VendorType = {
  REGISTERED_BUSINESS: 'registered_business',
  INDIVIDUAL_OWNER: 'individual_owner',
} as const;

const VendorRegistrationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

const VendorKycStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

const VendorVerificationStatus = {
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED_BUSINESS: 'verified_business',
  VERIFIED_OWNER: 'verified_owner',
  REJECTED: 'rejected',
} as const;

const VendorPayMongoOnboardingStatus = {
  NOT_STARTED: 'not_started',
  PROCESSING: 'processing',
  PROVISIONED: 'provisioned',
  FAILED: 'failed',
} as const;

const BusinessRegistrationType = {
  DTI: 'dti',
  SEC: 'sec',
} as const;

const VendorDocumentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEEDS_MANUAL_REVIEW: 'needs_manual_review',
} as const;

const VendorDocumentType = {
  GOVERNMENT_ID: 'government_id',
  SELFIE_VERIFICATION: 'selfie_verification',
  MAYORS_PERMIT: 'mayors_permit',
  BARANGAY_PERMIT: 'barangay_permit',
  BUSINESS_LOGO: 'business_logo',
} as const;

const VendorVerificationAction = {
  DUPLICATE_SIGNAL: 'duplicate_signal',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WARNING_RESET: 'warning_reset',
  FLAGGED: 'flagged',
  SUSPENDED: 'suspended',
  REACTIVATED: 'reactivated',
} as const;

const VendorItemVerificationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

const VendorItemPhotoType = {
  ITEM_ONLY: 'item_only',
  WITH_VENDOR_NAME_AND_DATE: 'with_vendor_name_and_date',
} as const;

const UserRole = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  CUSTOMER: 'customer',
} as const;

const BookingStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

vi.mock('./entities/vendor.entity', () => ({
  Vendor: class Vendor {},
  BusinessRegistrationType,
  VendorType,
  VendorRegistrationStatus,
  VendorKycStatus,
  VendorVerificationStatus,
  VendorPayMongoOnboardingStatus,
}));

vi.mock('./entities/vendor-document.entity', () => ({
  VendorDocument: class VendorDocument {},
  VendorDocumentStatus,
  VendorDocumentType,
}));

vi.mock('./entities/vendor-verification-status.entity', () => ({
  VendorVerificationAction,
  VendorVerificationStatusEntry: class VendorVerificationStatusEntry {},
}));

vi.mock('./entities/vendor-item.entity', () => ({
  VendorItem: class VendorItem {},
  VendorItemVerificationStatus,
}));

vi.mock('./entities/vendor-item-photo.entity', () => ({
  VendorItemPhoto: class VendorItemPhoto {},
  VendorItemPhotoType,
}));

vi.mock('./entities/vendor-phone-otp-challenge.entity', () => ({
  VendorPhoneOtpChallenge: class VendorPhoneOtpChallenge {},
}));

vi.mock('../inventory/entities/inventory-item.entity', () => ({
  InventoryItem: class InventoryItem {},
}));

vi.mock('../payments/entities/delivery-rate.entity', () => ({
  DeliveryRate: class DeliveryRate {},
}));

vi.mock('../bookings/entities/booking.entity', () => ({
  Booking: class Booking {},
  BookingStatus,
}));

vi.mock('../users/entities/user.entity', () => ({
  UserRole,
}));

let VendorsService: any;

function createService() {
  const vendorsRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    create: vi.fn((value) => value),
  };
  const documentsRepo = {
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    })),
  };
  const verificationStatusRepo = {
    findOne: vi.fn(),
    save: vi.fn(),
    create: vi.fn((value) => value),
  };
  const vendorItemsRepo = {
    findOne: vi.fn(),
    find: vi.fn(),
    save: vi.fn(),
    create: vi.fn((value) => value),
    update: vi.fn(),
  };
  const vendorItemPhotosRepo = {
    find: vi.fn(),
    save: vi.fn(),
    create: vi.fn((value) => value),
  };
  const otpChallengesRepo = {
    findOne: vi.fn(),
    save: vi.fn(),
    create: vi.fn((value) => value),
  };
  const inventoryRepo = {
    find: vi.fn(),
  };
  const deliveryRatesRepo = {
    find: vi.fn(),
  };
  const bookingsRepo = {
    createQueryBuilder: vi.fn(),
  };
  const usersService = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    updateRole: vi.fn(),
  };
  const emailService = {
    sendOtpEmail: vi.fn(),
    sendVendorApprovalEmail: vi.fn(),
  };
  const settingsService = {
    getFeatureFlagsSettings: vi.fn(),
    getKycSettings: vi.fn(),
  };

  const service = new VendorsService(
    vendorsRepo as any,
    documentsRepo as any,
    verificationStatusRepo as any,
    vendorItemsRepo as any,
    vendorItemPhotosRepo as any,
    otpChallengesRepo as any,
    inventoryRepo as any,
    deliveryRatesRepo as any,
    bookingsRepo as any,
    usersService as any,
    emailService as any,
    settingsService as any,
  );

  return {
    service,
    mocks: {
      vendorsRepo,
      settingsService,
    },
  };
}

describe('VendorsService', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    ({ VendorsService } = await import('./vendors.service'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('computes haversine distance consistently and symmetrically', () => {
    const { service } = createService();

    const aToB = (service as any).haversine(14.5995, 120.9842, 14.676, 121.0437);
    const bToA = (service as any).haversine(14.676, 121.0437, 14.5995, 120.9842);

    expect(aToB).toBeGreaterThan(5);
    expect(aToB).toBeLessThan(20);
    expect(Math.abs(aToB - bToA)).toBeLessThan(0.001);
  });

  it('selects helper-aware delivery rate tier based on distance', () => {
    const { service } = createService();

    const result = (service as any).estimateDeliveryCharge(8, 2, [
      { helpersCount: 1, distanceKm: 5, chargeAmount: 100 },
      { helpersCount: 1, distanceKm: 10, chargeAmount: 150 },
      { helpersCount: 2, distanceKm: 5, chargeAmount: 180 },
      { helpersCount: 2, distanceKm: 10, chargeAmount: 260 },
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        helpersCount: 2,
        distanceTierKm: 10,
        chargeAmount: 260,
      }),
    );
  });

  it('ranks vendors by required item match before price/distance', () => {
    const { service } = createService();

    const preferred = {
      businessName: 'Preferred Vendor',
      warningCount: 0,
      distanceKm: 25,
      matchedItemTypeCount: 2,
      hasAllRequiredItems: true,
      hasAnyDateRangeAvailability: true,
      estimatedDeliveryCharge: 300,
    };
    const notMatched = {
      businessName: 'Cheaper But Missing Items',
      warningCount: 0,
      distanceKm: 2,
      matchedItemTypeCount: 1,
      hasAllRequiredItems: false,
      hasAnyDateRangeAvailability: true,
      estimatedDeliveryCharge: 100,
    };

    const comparison = (service as any).compareVendorsByBestCriteria(
      preferred,
      notMatched,
      2,
    );

    expect(comparison).toBeLessThan(0);
  });

  it('normalizes existing merchant onboarding status to provisioned', async () => {
    const { service, mocks } = createService();
    const vendor = {
      id: 'vendor-1',
      paymongoMerchantId: 'merchant_123',
      paymongoOnboardingStatus: VendorPayMongoOnboardingStatus.FAILED,
      paymongoOnboardedAt: null,
    };

    const result = await (service as any).ensureVendorPayMongoMerchantOnApproval(vendor);

    expect(result).toBe('merchant_123');
    expect(mocks.vendorsRepo.update).toHaveBeenCalledWith(
      'vendor-1',
      expect.objectContaining({
        paymongoOnboardingStatus: VendorPayMongoOnboardingStatus.PROVISIONED,
      }),
    );
  });

  it('blocks approval when merchant ID is required and onboarding is disabled', async () => {
    const { service, mocks } = createService();
    process.env.PAYMONGO_VENDOR_ONBOARDING_ENABLED = 'false';
    process.env.PAYMONGO_VENDOR_ONBOARDING_REQUIRED = 'true';
    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      allowKycWithoutMerchantId: false,
    });

    await expect(
      (service as any).ensureVendorPayMongoMerchantOnApproval({
        id: 'vendor-1',
        paymongoMerchantId: null,
        paymongoOnboardingStatus: VendorPayMongoOnboardingStatus.NOT_STARTED,
        paymongoOnboardedAt: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('continues approval when onboarding fails but fallback is allowed', async () => {
    const { service, mocks } = createService();
    process.env.PAYMONGO_VENDOR_ONBOARDING_ENABLED = 'true';
    mocks.settingsService.getFeatureFlagsSettings.mockResolvedValue({
      allowKycWithoutMerchantId: true,
    });

    vi.spyOn(service as any, 'provisionPayMongoMerchantId').mockRejectedValue(
      new Error('upstream outage'),
    );

    const result = await (service as any).ensureVendorPayMongoMerchantOnApproval({
      id: 'vendor-1',
      paymongoMerchantId: null,
      paymongoOnboardingStatus: VendorPayMongoOnboardingStatus.NOT_STARTED,
      paymongoOnboardedAt: null,
      verificationStatus: VendorVerificationStatus.PENDING_VERIFICATION,
    });

    expect(result).toBeNull();
    expect(mocks.vendorsRepo.update).toHaveBeenCalledWith(
      'vendor-1',
      expect.objectContaining({
        paymongoOnboardingStatus: VendorPayMongoOnboardingStatus.FAILED,
      }),
    );
  });
});
