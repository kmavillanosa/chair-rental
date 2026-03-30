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
  | 'rejected'
  | 'suspended';

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
  deliveryVehicles?: { type: string; description?: string }[];
  phone?: string;
  phoneOtpVerifiedAt?: string;
  socialMediaLink?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumberMasked?: string;
  bankAccountLast4?: string;
  bankAccountNumber?: string;
  logoUrl?: string;
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
  isTestAccount?: boolean;
  averageRating?: number;
  totalRatings?: number;
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
  | 'pending'
  | 'unpaid'
  | 'checkout_pending'
  | 'paid'
  | 'held'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'disputed';

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

export type VendorPackageStatus =
  | 'eligible'
  | 'available'
  | 'partially_available'
  | 'disabled';

export interface VendorPackageItem {
  id: string;
  vendorPackageId: string;
  itemTypeId: string;
  itemType?: ItemType;
  requiredQty: number;
  unitPrice?: number | null;
  source: 'base' | 'override';
  createdAt: string;
  updatedAt: string;
}

export interface PublicVendorPackage {
  id: string;
  vendorId: string;
  basePackageId?: string | null;
  packageName: string;
  status: VendorPackageStatus;
  isActive: boolean;
  hasOverride: boolean;
  statusDate?: string | null;
  items: VendorPackageItem[];
  createdAt: string;
  updatedAt: string;
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
  notes?: string;
  pictureUrl?: string;
  galleryPhotos?: string[];
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

export interface BookingMessage {
  id: string;
  bookingId: string;
  senderUserId: string;
  senderRole: UserRole;
  content: string;
  redactedContent: string;
  flagReasons?: string | null;
  isFlagged: boolean;
  createdAt: string;
}

export interface BookingReview {
  id: string;
  bookingId: string;
  reviewerUserId: string;
  revieweeUserId: string;
  reviewerRole: UserRole;
  revieweeRole: UserRole;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorReview {
  id: string;
  vendorId: string;
  reviewerUserId: string;
  reviewerUser?: User;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDeliveryProof {
  id: string;
  bookingId: string;
  vendorId: string;
  photoUrl: string;
  signatureUrl?: string | null;
  note?: string | null;
  capturedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BookingDocumentType = 'contract' | 'receipt';
export type BookingDocumentIssuedTo = 'customer' | 'vendor' | 'both';

export interface BookingDocument {
  id: string;
  bookingId: string;
  documentType: BookingDocumentType;
  issuedTo: BookingDocumentIssuedTo;
  title: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  fileHash: string;
  signature: string;
  signatureAlgorithm: string;
  signaturePayloadHash: string;
  generatedAt: string;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BookingDisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';
export type BookingDisputeOutcome =
  | 'refund_customer'
  | 'release_payment_to_vendor'
  | 'partial_refund';

export interface BookingDisputeEvidence {
  id: string;
  disputeId: string;
  uploadedByUserId: string;
  uploadedByRole: UserRole;
  fileUrl: string;
  note?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface BookingDispute {
  id: string;
  bookingId: string;
  openedByUserId: string;
  openedByRole: UserRole;
  reason: string;
  status: BookingDisputeStatus;
  outcome?: BookingDisputeOutcome | null;
  refundAmount?: number | null;
  resolutionNote?: string | null;
  resolvedByUserId?: string | null;
  resolvedAt?: string | null;
  evidence?: BookingDisputeEvidence[];
  createdAt: string;
  updatedAt: string;
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
  depositPercentage?: number;
  depositAmount?: number;
  remainingBalanceAmount?: number;
  totalPaidAmount?: number;
  escrowHeldAmount?: number;
  escrowReleasedAmount?: number;
  paymentStatus: BookingPaymentStatus;
  paymentProvider?: string;
  paymentReference?: string;
  paymentCheckoutSessionId?: string;
  paymentCheckoutUrl?: string;
  paymentPaidAt?: string;
  depositPaidAt?: string;
  finalPaymentPaidAt?: string;
  escrowHeldAt?: string;
  escrowReleasedAt?: string;
  vendorMarkedDeliveredAt?: string;
  customerConfirmedDeliveryAt?: string;
  customerConfirmedDeliveryByUserId?: string;
  fraudRiskScore?: number;
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
  messages?: BookingMessage[];
  reviews?: BookingReview[];
  deliveryProofs?: BookingDeliveryProof[];
  documents?: BookingDocument[];
  createdAt: string;
}

export type VendorPayoutStatus =
  | 'pending'
  | 'held'
  | 'ready'
  | 'released'
  | 'refunded'
  | 'disputed'
  | 'cancelled';

export interface VendorPayout {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  bookingId: string;
  booking?: Booking;
  grossAmount: number;
  platformFeeAmount: number;
  netAmount: number;
  depositHeldAmount: number;
  outstandingBalanceAmount: number;
  status: VendorPayoutStatus;
  releaseOn?: string | null;
  heldAt?: string | null;
  releasedAt?: string | null;
  disputeLockedAt?: string | null;
  notes?: string | null;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FraudAlertStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type FraudAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FraudAlertType =
  | 'booking_risk'
  | 'off_platform_message'
  | 'vendor_kyc'
  | 'dispute'
  | 'low_rating_vendor'
  | 'ip_reuse'
  | 'cancellation_pattern'
  | 'unusual_booking_frequency';

export interface FraudAlert {
  id: string;
  type: FraudAlertType;
  severity: FraudAlertSeverity;
  status: FraudAlertStatus;
  title: string;
  description: string;
  userId?: string | null;
  vendorId?: string | null;
  bookingId?: string | null;
  messageId?: string | null;
  disputeId?: string | null;
  metadata?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
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

export type HelpersPricingMode = 'tiered' | 'fixed' | 'hourly';

export interface VendorDeliveryPricingTier {
  id: string;
  pricingConfigId: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  priceAmount: number;
  sortOrder: number;
}

export interface VendorHelperPricingTier {
  id: string;
  pricingConfigId: string;
  helperCount: number;
  priceAmount: number;
  sortOrder: number;
}

export interface VendorPricingConfig {
  id: string;
  vendorId: string;
  deliveryFreeRadiusKm: number;
  deliveryPerKmEnabled: boolean;
  deliveryPerKmRate: number | null;
  helpersEnabled: boolean;
  helpersPricingMode: HelpersPricingMode;
  helpersFixedPrice: number | null;
  helpersHourlyRate: number | null;
  helpersMaxCount: number;
  waitingFeePerHour: number;
  nightSurcharge: number;
  minOrderAmount: number;
  isActive: boolean;
  notes?: string | null;
  deliveryTiers: VendorDeliveryPricingTier[];
  helperTiers: VendorHelperPricingTier[];
  createdAt: string;
  updatedAt: string;
}
