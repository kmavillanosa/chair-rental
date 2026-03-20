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
  const dataSource = {
    transaction: vi.fn(),
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
    dataSource as any,
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

  describe('normalizeSlug', () => {
    it('converts spaces and special chars to hyphens', () => {
      const { service } = createService();
      expect((service as any).normalizeSlug('Hello World!')).toBe('hello-world');
    });

    it('strips leading and trailing hyphens', () => {
      const { service } = createService();
      expect((service as any).normalizeSlug('--ABC--')).toBe('abc');
    });

    it('collapses consecutive non-alphanumeric chars to single hyphen', () => {
      const { service } = createService();
      expect((service as any).normalizeSlug('foo   bar')).toBe('foo-bar');
    });

    it('handles empty string gracefully', () => {
      const { service } = createService();
      expect((service as any).normalizeSlug('')).toBe('');
    });
  });

  describe('normalizeVendorType', () => {
    it('recognises individual_owner', () => {
      const { service } = createService();
      expect((service as any).normalizeVendorType('individual_owner')).toBe(
        VendorType.INDIVIDUAL_OWNER,
      );
    });

    it('defaults unrecognised input to registered_business', () => {
      const { service } = createService();
      expect((service as any).normalizeVendorType('unknown')).toBe(
        VendorType.REGISTERED_BUSINESS,
      );
    });

    it('defaults undefined to registered_business', () => {
      const { service } = createService();
      expect((service as any).normalizeVendorType(undefined)).toBe(
        VendorType.REGISTERED_BUSINESS,
      );
    });
  });

  describe('normalizeVerificationStatus', () => {
    it('returns verified_business for valid status', () => {
      const { service } = createService();
      expect((service as any).normalizeVerificationStatus('verified_business')).toBe(
        VendorVerificationStatus.VERIFIED_BUSINESS,
      );
    });

    it('returns verified_owner for valid status', () => {
      const { service } = createService();
      expect((service as any).normalizeVerificationStatus('verified_owner')).toBe(
        VendorVerificationStatus.VERIFIED_OWNER,
      );
    });

    it('returns pending_verification for valid status', () => {
      const { service } = createService();
      expect((service as any).normalizeVerificationStatus('pending_verification')).toBe(
        VendorVerificationStatus.PENDING_VERIFICATION,
      );
    });

    it('returns null for unrecognised status', () => {
      const { service } = createService();
      expect((service as any).normalizeVerificationStatus('bogus')).toBeNull();
    });

    it('returns null for undefined', () => {
      const { service } = createService();
      expect((service as any).normalizeVerificationStatus(undefined)).toBeNull();
    });
  });

  describe('normalizeBusinessRegistrationType', () => {
    it('recognises dti', () => {
      const { service } = createService();
      expect((service as any).normalizeBusinessRegistrationType('dti')).toBe(
        BusinessRegistrationType.DTI,
      );
    });

    it('recognises sec', () => {
      const { service } = createService();
      expect((service as any).normalizeBusinessRegistrationType('sec')).toBe(
        BusinessRegistrationType.SEC,
      );
    });

    it('returns null for unknown type', () => {
      const { service } = createService();
      expect((service as any).normalizeBusinessRegistrationType('other')).toBeNull();
    });

    it('returns null for undefined', () => {
      const { service } = createService();
      expect((service as any).normalizeBusinessRegistrationType(undefined)).toBeNull();
    });
  });

  describe('normalizeText', () => {
    it('trims whitespace', () => {
      const { service } = createService();
      expect((service as any).normalizeText('  hello  ')).toBe('hello');
    });

    it('returns null for empty string', () => {
      const { service } = createService();
      expect((service as any).normalizeText('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      const { service } = createService();
      expect((service as any).normalizeText('   ')).toBeNull();
    });

    it('returns null for null input', () => {
      const { service } = createService();
      expect((service as any).normalizeText(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      const { service } = createService();
      expect((service as any).normalizeText(undefined)).toBeNull();
    });
  });

  describe('normalizeIdentifier', () => {
    it('uppercases and strips spaces', () => {
      const { service } = createService();
      expect((service as any).normalizeIdentifier('abc 123')).toBe('ABC123');
    });

    it('returns null for empty input', () => {
      const { service } = createService();
      expect((service as any).normalizeIdentifier('')).toBeNull();
    });

    it('returns null for null input', () => {
      const { service } = createService();
      expect((service as any).normalizeIdentifier(null)).toBeNull();
    });
  });

  describe('normalizeTin', () => {
    it('returns null for empty input', () => {
      const { service } = createService();
      expect((service as any).normalizeTin(null)).toBeNull();
      expect((service as any).normalizeTin('')).toBeNull();
    });

    it('accepts well-formed TIN with dashes', () => {
      const { service } = createService();
      expect((service as any).normalizeTin('123-456-789')).toBe('123-456-789');
    });

    it('accepts TIN without dashes', () => {
      const { service } = createService();
      expect((service as any).normalizeTin('123456789')).toBe('123456789');
    });

    it('throws BadRequestException for malformed TIN', () => {
      const { service } = createService();
      expect(() => (service as any).normalizeTin('not-a-tin')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizePhone', () => {
    it('returns null for empty input', () => {
      const { service } = createService();
      expect((service as any).normalizePhone(null)).toBeNull();
      expect((service as any).normalizePhone('')).toBeNull();
    });

    it('accepts valid international phone', () => {
      const { service } = createService();
      expect((service as any).normalizePhone('+639171234567')).toBe('+639171234567');
    });

    it('accepts 10 digit phone', () => {
      const { service } = createService();
      expect((service as any).normalizePhone('9171234567')).toBe('9171234567');
    });

    it('throws BadRequestException for non-digit non-plus input', () => {
      const { service } = createService();
      // 'abc123' strips to '123' — only 3 digits, below the 10-digit minimum
      expect(() => (service as any).normalizePhone('abc123')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for too-short digit string', () => {
      const { service } = createService();
      expect(() => (service as any).normalizePhone('12345')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizeEmail', () => {
    it('returns null for empty input', () => {
      const { service } = createService();
      expect((service as any).normalizeEmail('')).toBeNull();
      expect((service as any).normalizeEmail(null)).toBeNull();
    });

    it('lowercases and returns valid email', () => {
      const { service } = createService();
      expect((service as any).normalizeEmail('Vendor@Example.COM')).toBe(
        'vendor@example.com',
      );
    });

    it('throws BadRequestException for invalid email format', () => {
      const { service } = createService();
      expect(() => (service as any).normalizeEmail('not-an-email')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizeDocumentType', () => {
    it('maps government_id canonical value', () => {
      const { service } = createService();
      expect((service as any).normalizeDocumentType('government_id')).toBe(
        VendorDocumentType.GOVERNMENT_ID,
      );
    });

    it('maps selfie alias to selfie_verification', () => {
      const { service } = createService();
      expect((service as any).normalizeDocumentType('selfie')).toBe(
        VendorDocumentType.SELFIE_VERIFICATION,
      );
    });

    it('maps logo alias to business_logo', () => {
      const { service } = createService();
      expect((service as any).normalizeDocumentType('logo')).toBe(
        VendorDocumentType.BUSINESS_LOGO,
      );
    });

    it('maps mayors_permit canonical value', () => {
      const { service } = createService();
      expect((service as any).normalizeDocumentType('mayors_permit')).toBe(
        VendorDocumentType.MAYORS_PERMIT,
      );
    });

    it('maps barangay_permit canonical value', () => {
      const { service } = createService();
      expect((service as any).normalizeDocumentType('barangay_permit')).toBe(
        VendorDocumentType.BARANGAY_PERMIT,
      );
    });

    it('returns null for unknown document type', () => {
      const { service } = createService();
      expect((service as any).normalizeDocumentType('unknown_type')).toBeNull();
    });
  });

  describe('normalizeVendorItemPhotoType', () => {
    it('maps item_only canonical value', () => {
      const { service } = createService();
      expect((service as any).normalizeVendorItemPhotoType('item_only')).toBe(
        VendorItemPhotoType.ITEM_ONLY,
      );
    });

    it('maps proof alias', () => {
      const { service } = createService();
      expect((service as any).normalizeVendorItemPhotoType('proof')).toBe(
        VendorItemPhotoType.WITH_VENDOR_NAME_AND_DATE,
      );
    });

    it('returns null for unknown type', () => {
      const { service } = createService();
      expect((service as any).normalizeVendorItemPhotoType('other')).toBeNull();
    });
  });

  describe('hashValue', () => {
    it('returns null for falsy input', () => {
      const { service } = createService();
      expect((service as any).hashValue(null)).toBeNull();
      expect((service as any).hashValue('')).toBeNull();
    });

    it('returns a hex string for non-empty input', () => {
      const { service } = createService();
      const result = (service as any).hashValue('test');
      expect(typeof result).toBe('string');
      expect(result).toHaveLength(64);
    });

    it('is deterministic for the same input', () => {
      const { service } = createService();
      expect((service as any).hashValue('same')).toBe(
        (service as any).hashValue('same'),
      );
    });
  });

  describe('hashOtp', () => {
    it('returns a 64-char hex string', () => {
      const { service } = createService();
      const result = (service as any).hashOtp('+639171234567', '123456');
      expect(typeof result).toBe('string');
      expect(result).toHaveLength(64);
    });

    it('is deterministic for same inputs', () => {
      const { service } = createService();
      const a = (service as any).hashOtp('+639171234567', '123456');
      const b = (service as any).hashOtp('+639171234567', '123456');
      expect(a).toBe(b);
    });

    it('differs for different OTP codes', () => {
      const { service } = createService();
      const a = (service as any).hashOtp('+639171234567', '111111');
      const b = (service as any).hashOtp('+639171234567', '222222');
      expect(a).not.toBe(b);
    });
  });

  describe('withVerificationBadge', () => {
    it('returns null passthrough for null vendor', () => {
      const { service } = createService();
      expect((service as any).withVerificationBadge(null)).toBeNull();
    });

    it('adds verificationBadge string for verified_business status', () => {
      const { service } = createService();
      const vendor = {
        id: 'v-1',
        verificationStatus: VendorVerificationStatus.VERIFIED_BUSINESS,
        verificationBadge: null,
        isVerified: true,
        registrationStatus: VendorRegistrationStatus.APPROVED,
        vendorType: VendorType.REGISTERED_BUSINESS,
      };
      const result = (service as any).withVerificationBadge(vendor);
      expect(result).toHaveProperty('verificationBadge');
      expect(typeof result.verificationBadge).toBe('string');
      expect(result.verificationBadge).toBe('Verified Business');
    });

    it('returns null badge for non-verified status', () => {
      const { service } = createService();
      const vendor = {
        id: 'v-2',
        verificationStatus: VendorVerificationStatus.PENDING_VERIFICATION,
        verificationBadge: null,
        isVerified: false,
        registrationStatus: VendorRegistrationStatus.PENDING,
        vendorType: VendorType.REGISTERED_BUSINESS,
      };
      const result = (service as any).withVerificationBadge(vendor);
      expect(result.verificationBadge).toBeNull();
    });

    it('does not recompute badge if already set', () => {
      const { service } = createService();
      const vendor = {
        id: 'v-3',
        verificationStatus: VendorVerificationStatus.PENDING_VERIFICATION,
        verificationBadge: 'Already Set',
        isVerified: false,
        registrationStatus: VendorRegistrationStatus.PENDING,
        vendorType: VendorType.REGISTERED_BUSINESS,
      };
      const result = (service as any).withVerificationBadge(vendor);
      expect(result.verificationBadge).toBe('Already Set');
    });
  });

  describe('parseBooleanFlag', () => {
    it('treats "true" as true', () => {
      const { service } = createService();
      expect((service as any).parseBooleanFlag('true')).toBe(true);
    });

    it('treats "1" as true', () => {
      const { service } = createService();
      expect((service as any).parseBooleanFlag('1')).toBe(true);
    });

    it('treats "yes" as true', () => {
      const { service } = createService();
      expect((service as any).parseBooleanFlag('yes')).toBe(true);
    });

    it('treats "on" as true', () => {
      const { service } = createService();
      expect((service as any).parseBooleanFlag('on')).toBe(true);
    });

    it('treats "false" as false', () => {
      const { service } = createService();
      expect((service as any).parseBooleanFlag('false')).toBe(false);
    });

    it('treats null as false', () => {
      const { service } = createService();
      expect((service as any).parseBooleanFlag(null)).toBe(false);
    });

    it('treats undefined as false', () => {
      const { service } = createService();
      expect((service as any).parseBooleanFlag(undefined)).toBe(false);
    });
  });
});
