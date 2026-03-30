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
import { VendorPricingConfig } from '../payments/entities/vendor-pricing-config.entity';
import { VendorDeliveryPricingTier } from '../payments/entities/vendor-delivery-pricing-tier.entity';
import { VendorHelperPricingTier } from '../payments/entities/vendor-helper-pricing-tier.entity';
import { AdminPackageTemplate } from '../packages/entities/admin-package-template.entity';
import { AdminPackageTemplateItem } from '../packages/entities/admin-package-template-item.entity';
import { VendorPackage } from '../packages/entities/vendor-package.entity';
import { VendorPackageItem } from '../packages/entities/vendor-package-item.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PackageEligibilitySeedService } from './package-eligibility-seed.service';

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
      VendorPricingConfig,
      VendorDeliveryPricingTier,
      VendorHelperPricingTier,
      AdminPackageTemplate,
      AdminPackageTemplateItem,
      VendorPackage,
      VendorPackageItem,
      Booking,
    ]),
  ],
  providers: [
    CatalogSeedService,
    VendorDistanceSeedService,
    TestVendorsSeedService,
    PackageEligibilitySeedService,
  ],
  exports: [
    CatalogSeedService,
    VendorDistanceSeedService,
    TestVendorsSeedService,
    PackageEligibilitySeedService,
  ],
})
export class SeedsModule {}