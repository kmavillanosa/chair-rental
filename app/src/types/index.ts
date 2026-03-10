// User types
export type UserRole = 'admin' | 'vendor' | 'customer';

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
  businessName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  slug: string;
  description?: string;
  phone?: string;
  logoUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  commissionRate: number;
  balance: number;
  warningCount: number;
  suspendedUntil?: string;
  distanceKm?: number;
  createdAt: string;
}

export interface ItemType {
  id: string;
  name: string;
  description?: string;
  pictureUrl?: string;
  defaultRatePerDay: number;
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
  deliveryCharge: number;
  serviceCharge: number;
  platformFee: number;
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

export interface AdminStats {
  totalVendors: number;
  activeVendors: number;
  totalBookings: number;
  pendingPayments: number;
}
