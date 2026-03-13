import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { VendorPayment } from '../payments/entities/vendor-payment.entity';
import { VendorsModule } from '../vendors/vendors.module';
import { Vendor } from '../vendors/entities/vendor.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      InventoryItem,
      VendorPayment,
      Vendor,
    ]),
    VendorsModule,
    SettingsModule,
  ],
  providers: [BookingsService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
