import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem } from './entities/inventory-item.entity';
import { VendorsModule } from '../vendors/vendors.module';
import { ItemType } from '../item-types/entities/item-type.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, ItemType, Booking, BookingItem]), VendorsModule],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
