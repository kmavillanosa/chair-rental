import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Vendor } from './vendor.entity';
import { VendorItemPhoto } from './vendor-item-photo.entity';

export enum VendorItemVerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('vendor_items')
@Index('IDX_vendor_items_vendor_status', ['vendorId', 'verificationStatus'])
@Index('IDX_vendor_items_inventory_item', ['inventoryItemId'])
export class VendorItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.verificationItems)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 36, nullable: true })
  inventoryItemId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: VendorItemVerificationStatus,
    default: VendorItemVerificationStatus.PENDING,
  })
  verificationStatus: VendorItemVerificationStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ default: false })
  isSuspicious: boolean;

  @OneToMany(() => VendorItemPhoto, (photo) => photo.vendorItem, { cascade: true })
  photos: VendorItemPhoto[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
