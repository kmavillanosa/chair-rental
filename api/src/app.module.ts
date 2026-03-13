import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';
import { ItemTypesModule } from './item-types/item-types.module';
import { BrandsModule } from './brands/brands.module';
import { InventoryModule } from './inventory/inventory.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { User } from './users/entities/user.entity';
import { Vendor } from './vendors/entities/vendor.entity';
import { ItemType } from './item-types/entities/item-type.entity';
import { ProductBrand } from './brands/entities/product-brand.entity';
import { InventoryItem } from './inventory/entities/inventory-item.entity';
import { Booking } from './bookings/entities/booking.entity';
import { BookingItem } from './bookings/entities/booking-item.entity';
import { VendorPayment } from './payments/entities/vendor-payment.entity';
import { DeliveryRate } from './payments/entities/delivery-rate.entity';
import { VendorDocument } from './vendors/entities/vendor-document.entity';
import { VendorVerificationStatusEntry } from './vendors/entities/vendor-verification-status.entity';
import { VendorItem } from './vendors/entities/vendor-item.entity';
import { VendorItemPhoto } from './vendors/entities/vendor-item-photo.entity';
import { VendorPhoneOtpChallenge } from './vendors/entities/vendor-phone-otp-challenge.entity';
import { SeedsModule } from './seeds/seeds.module';
import { SettingsModule } from './settings/settings.module';
import { PlatformSetting } from './settings/entities/platform-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
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
        VendorPayment,
        DeliveryRate,
      ],
      synchronize:
        typeof process.env.DB_SYNC === 'string'
          ? ['1', 'true', 'yes'].includes(process.env.DB_SYNC.toLowerCase())
          : process.env.NODE_ENV !== 'production',
      autoLoadEntities: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    UsersModule,
    VendorsModule,
    ItemTypesModule,
    BrandsModule,
    InventoryModule,
    BookingsModule,
    PaymentsModule,
    SettingsModule,
    SeedsModule,
  ],
})
export class AppModule {}
