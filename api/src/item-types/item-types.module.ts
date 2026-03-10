import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemTypesService } from './item-types.service';
import { ItemTypesController } from './item-types.controller';
import { ItemType } from './entities/item-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ItemType])],
  providers: [ItemTypesService],
  controllers: [ItemTypesController],
  exports: [ItemTypesService],
})
export class ItemTypesModule {}
