import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemType } from '../item-types/entities/item-type.entity';
import { ProductBrand } from '../brands/entities/product-brand.entity';
import { CatalogSeedService } from './catalog-seed.service';
import { Vendor } from '../vendors/entities/vendor.entity';
import { DeliveryRate } from '../payments/entities/delivery-rate.entity';
import { VendorDistanceSeedService } from './vendor-distance-seed.service';
import { User } from '../users/entities/user.entity';
import { TestVendorsSeedService } from './test-vendors-seed.service';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { VendorItem } from '../vendors/entities/vendor-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItemType,
      ProductBrand,
      Vendor,
      DeliveryRate,
      User,
      InventoryItem,
      VendorItem,
    ]),
  ],
  providers: [
    CatalogSeedService,
    VendorDistanceSeedService,
    TestVendorsSeedService,
  ],
  exports: [
    CatalogSeedService,
    VendorDistanceSeedService,
    TestVendorsSeedService,
  ],
})
export class SeedsModule {}