import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, ManyToOne, JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { ItemType } from '../../item-types/entities/item-type.entity';
import { ProductBrand } from '../../brands/entities/product-brand.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 36 })
  itemTypeId: string;

  @ManyToOne(() => ItemType)
  @JoinColumn({ name: 'itemTypeId' })
  itemType: ItemType;

  @Column({ type: 'varchar', length: 36, nullable: true })
  brandId: string;

  @ManyToOne(() => ProductBrand, { nullable: true })
  @JoinColumn({ name: 'brandId' })
  brand: ProductBrand;

  @Column({ default: 0 })
  quantity: number;

  @Column({ default: 0 })
  availableQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  ratePerDay: number;

  @Column({ nullable: true })
  condition: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  pictureUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
