import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { Vendor } from './entities/vendor.entity';
import { VendorDocument } from './entities/vendor-document.entity';
import { VendorVerificationStatusEntry } from './entities/vendor-verification-status.entity';
import { VendorItem } from './entities/vendor-item.entity';
import { VendorItemPhoto } from './entities/vendor-item-photo.entity';
import { VendorPhoneOtpChallenge } from './entities/vendor-phone-otp-challenge.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { DeliveryRate } from '../payments/entities/delivery-rate.entity';
import { UsersModule } from '../users/users.module';
import { Booking } from '../bookings/entities/booking.entity';
import { EmailService } from '../common/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vendor,
      VendorDocument,
      VendorVerificationStatusEntry,
      VendorItem,
      VendorItemPhoto,
      VendorPhoneOtpChallenge,
      InventoryItem,
      DeliveryRate,
      Booking,
    ]),
    UsersModule,
  ],
  providers: [VendorsService, EmailService],
  controllers: [VendorsController],
  exports: [VendorsService],
})
export class VendorsModule {}
