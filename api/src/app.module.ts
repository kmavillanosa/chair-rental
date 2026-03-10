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

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'chair_rental',
      entities: [User, Vendor, ItemType, ProductBrand, InventoryItem, Booking, BookingItem, VendorPayment, DeliveryRate],
      synchronize: process.env.NODE_ENV !== 'production',
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
  ],
})
export class AppModule {}
