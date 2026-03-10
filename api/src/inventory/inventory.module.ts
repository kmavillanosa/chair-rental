import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem } from './entities/inventory-item.entity';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem]), VendorsModule],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
