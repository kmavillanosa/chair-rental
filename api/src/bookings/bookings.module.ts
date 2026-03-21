import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingMessage } from './entities/booking-message.entity';
import { BookingReview } from './entities/booking-review.entity';
import { BookingDeliveryProof } from './entities/booking-delivery-proof.entity';
import { BookingDocument } from './entities/booking-document.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { VendorPayment } from '../payments/entities/vendor-payment.entity';
import { VendorPayout } from '../payments/entities/vendor-payout.entity';
import { VendorsModule } from '../vendors/vendors.module';
import { Vendor } from '../vendors/entities/vendor.entity';
import { SettingsModule } from '../settings/settings.module';
import { FraudModule } from '../fraud/fraud.module';
import { User } from '../users/entities/user.entity';
import { ChatModule } from '../chat/chat.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      BookingMessage,
      BookingReview,
      BookingDeliveryProof,
      BookingDocument,
      InventoryItem,
      VendorPayment,
      VendorPayout,
      Vendor,
      User,
    ]),
    VendorsModule,
    PaymentsModule,
    SettingsModule,
    FraudModule,
    ChatModule,
  ],
  providers: [BookingsService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
