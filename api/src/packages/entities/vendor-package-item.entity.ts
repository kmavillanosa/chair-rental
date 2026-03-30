import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ItemType } from '../../item-types/entities/item-type.entity';
import { VendorPackage } from './vendor-package.entity';

export enum VendorPackageItemSource {
  BASE = 'base',
  OVERRIDE = 'override',
}

@Entity('vendor_package_items')
@Index('IDX_vendor_package_items_unique', ['vendorPackageId', 'itemTypeId'], {
  unique: true,
})
export class VendorPackageItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorPackageId: string;

  @ManyToOne(() => VendorPackage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorPackageId' })
  vendorPackage: VendorPackage;

  @Column({ type: 'varchar', length: 36 })
  itemTypeId: string;

  @ManyToOne(() => ItemType)
  @JoinColumn({ name: 'itemTypeId' })
  itemType: ItemType;

  @Column({ type: 'int' })
  requiredQty: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ type: 'enum', enum: VendorPackageItemSource, default: VendorPackageItemSource.BASE })
  source: VendorPackageItemSource;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}