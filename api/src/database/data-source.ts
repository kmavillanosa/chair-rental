import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { VendorDocument } from '../vendors/entities/vendor-document.entity';
import { VendorVerificationStatusEntry } from '../vendors/entities/vendor-verification-status.entity';
import { VendorItem } from '../vendors/entities/vendor-item.entity';
import { VendorItemPhoto } from '../vendors/entities/vendor-item-photo.entity';
import { VendorPhoneOtpChallenge } from '../vendors/entities/vendor-phone-otp-challenge.entity';
import { PlatformSetting } from '../settings/entities/platform-setting.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { ProductBrand } from '../brands/entities/product-brand.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { BookingMessage } from '../bookings/entities/booking-message.entity';
import { BookingReview } from '../bookings/entities/booking-review.entity';
import { BookingDeliveryProof } from '../bookings/entities/booking-delivery-proof.entity';
import { BookingDocument } from '../bookings/entities/booking-document.entity';
import { VendorPayment } from '../payments/entities/vendor-payment.entity';
import { VendorPayout } from '../payments/entities/vendor-payout.entity';
import { DeliveryRate } from '../payments/entities/delivery-rate.entity';
import { FraudAlert } from '../fraud/entities/fraud-alert.entity';
import { BookingDispute } from '../disputes/entities/booking-dispute.entity';
import { BookingDisputeEvidence } from '../disputes/entities/booking-dispute-evidence.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chair_rental',
  entities: [
    User,
    Vendor,
    VendorDocument,
    VendorVerificationStatusEntry,
    VendorItem,
    VendorItemPhoto,
    VendorPhoneOtpChallenge,
    PlatformSetting,
    ItemType,
    ProductBrand,
    InventoryItem,
    Booking,
    BookingItem,
    BookingMessage,
    BookingReview,
    BookingDeliveryProof,
    BookingDocument,
    VendorPayment,
    VendorPayout,
    DeliveryRate,
    FraudAlert,
    BookingDispute,
    BookingDisputeEvidence,
  ],
  migrations: [join(__dirname, 'migrations', '*{.js,.ts}')],
  synchronize: false,
});