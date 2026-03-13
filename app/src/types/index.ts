// User types
export type UserRole = 'admin' | 'vendor' | 'customer';
export type VendorType = 'registered_business' | 'individual_owner';
export type BusinessRegistrationType = 'dti' | 'sec';
export type VendorRegistrationStatus = 'pending' | 'approved' | 'rejected';
export type VendorKycStatus = 'pending' | 'approved' | 'rejected';
export type VendorVerificationStatus =
  | 'pending_verification'
  | 'verified_business'
  | 'verified_owner'
  | 'rejected';
export type VendorPayMongoOnboardingStatus =
  | 'not_started'
  | 'processing'
  | 'provisioned'
  | 'failed';

export interface VendorDocument {
  id: string;
  vendorId: string;
  documentType:
    | 'government_id'
    | 'selfie_verification'
    | 'mayors_permit'
    | 'barangay_permit'
    | 'business_logo';
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_manual_review';
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface VendorItemPhoto {
  id: string;
  vendorItemId: string;
  photoType: 'item_only' | 'with_vendor_name_and_date';
  fileUrl: string;
  createdAt: string;
}

export interface VendorItemVerification {
  id: string;
  vendorId: string;
  inventoryItemId?: string;
  title: string;
  description?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  photos?: VendorItemPhoto[];
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Vendor {
  id: string;
  userId: string;
  user?: User;
  vendorType?: VendorType;
  businessName: string;
  businessRegistrationType?: BusinessRegistrationType;
  businessRegistrationNumber?: string;
  birTin?: string;
  ownerFullName?: string;
  governmentIdNumber?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  slug: string;
  description?: string;
  phone?: string;
  phoneOtpVerifiedAt?: string;
  socialMediaLink?: string;
  logoUrl?: string;
  paymongoMerchantId?: string;
  paymongoOnboardingStatus?: VendorPayMongoOnboardingStatus;
  paymongoOnboardingError?: string;
  paymongoOnboardedAt?: string;
  registrationStatus?: VendorRegistrationStatus;
  kycStatus?: VendorKycStatus;
  verificationStatus?: VendorVerificationStatus;
  verificationBadge?: string;
  kycDocumentUrl?: string;
  kycNotes?: string;
  rejectionReason?: string;
  kycSubmittedAt?: string;
  reviewedAt?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  duplicateRiskScore?: number;
  duplicateSignals?: string;
  faceMatchStatus?: string;
  faceMatchScore?: number;
  documents?: VendorDocument[];
  verificationItems?: VendorItemVerification[];
  isActive: boolean;
  isVerified: boolean;
  commissionRate: number;
  balance: number;
  warningCount: number;
  suspendedUntil?: string;
  distanceKm?: number;
  matchedItemTypeCount?: number;
  hasAllRequiredItems?: boolean;
  estimatedDeliveryCharge?: number | null;
  estimatedHelpersCount?: number;
  estimatedDistanceTierKm?: number | null;
  createdAt: string;
}

export type BookingPaymentStatus =
  | 'unpaid'
  | 'checkout_pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface ItemType {
  id: string;
  name: string;
  description?: string;
  pictureUrl?: string;
  defaultRatePerDay: number;
  eventTags?: string[];
  setTags?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ProductBrand {
  id: string;
  itemTypeId: string;
  itemType?: ItemType;
  name: string;
  description?: string;
  logoUrl?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  vendorId: string;
  itemTypeId: string;
  itemType?: ItemType;
  brandId?: string;
  brand?: ProductBrand;
  color?: string;
  quantity: number;
  availableQuantity: number;
  ratePerDay: number;
  condition?: string;
  pictureUrl?: string;
  createdAt: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface BookingItem {
  id: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  quantity: number;
  ratePerDay: number;
  subtotal: number;
}

export interface Booking {
  id: string;
  customerId: string;
  customer?: User;
  vendorId: string;
  vendor?: Vendor;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  totalAmount: number;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryCharge: number;
  serviceCharge: number;
  platformFee: number;
  paymentStatus: BookingPaymentStatus;
  paymentProvider?: string;
  paymentReference?: string;
  paymentCheckoutSessionId?: string;
  paymentCheckoutUrl?: string;
  paymentPaidAt?: string;
  cancelledAt?: string;
  cancellationRequestedByUserId?: string;
  cancellationRequestedByRole?: UserRole;
  cancellationPolicyCode?:
    | 'full_refund_3_days'
    | 'half_refund_24_hours'
    | 'same_day_no_refund'
    | 'vendor_or_admin_full_refund';
  cancellationRefundPercent?: number;
  cancellationRefundAmount?: number;
  notes?: string;
  items?: BookingItem[];
  createdAt: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export interface VendorPayment {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  period?: string;
  paidAt?: string;
  transactionRef?: string;
  createdAt: string;
}

export interface DeliveryRate {
  id: string;
  vendorId: string;
  distanceKm: number;
  chargeAmount: number;
  helpersCount: number;
}
