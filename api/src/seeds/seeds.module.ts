import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemType } from '../item-types/entities/item-type.entity';
import { ProductBrand } from '../brands/entities/product-brand.entity';
import { CatalogSeedService } from './catalog-seed.service';
import { Vendor } from '../vendors/entities/vendor.entity';
import { DeliveryRate } from '../payments/entities/delivery-rate.entity';
import { VendorDistanceSeedService } from './vendor-distance-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ItemType, ProductBrand, Vendor, DeliveryRate]),
  ],
  providers: [CatalogSeedService, VendorDistanceSeedService],
  exports: [CatalogSeedService, VendorDistanceSeedService],
})
export class SeedsModule {}