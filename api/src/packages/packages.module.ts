import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { AdminPackageTemplate } from './entities/admin-package-template.entity';
import { AdminPackageTemplateItem } from './entities/admin-package-template-item.entity';
import { VendorPackage } from './entities/vendor-package.entity';
import { VendorPackageItem } from './entities/vendor-package-item.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { Vendor } from '../vendors/entities/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminPackageTemplate,
      AdminPackageTemplateItem,
      VendorPackage,
      VendorPackageItem,
      ItemType,
      Vendor,
    ]),
  ],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}