import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { AdminPackageTemplate } from './entities/admin-package-template.entity';
import { AdminPackageTemplateItem } from './entities/admin-package-template-item.entity';
import { ItemType } from '../item-types/entities/item-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminPackageTemplate,
      AdminPackageTemplateItem,
      ItemType,
    ]),
  ],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}