import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VendorItem } from './vendor-item.entity';

export enum VendorItemPhotoType {
  ITEM_ONLY = 'item_only',
  WITH_VENDOR_NAME_AND_DATE = 'with_vendor_name_and_date',
}

@Entity('vendor_item_photos')
@Index('IDX_vendor_item_photos_item_type', ['vendorItemId', 'photoType'])
@Index('IDX_vendor_item_photos_created', ['createdAt'])
export class VendorItemPhoto {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorItemId: string;

  @ManyToOne(() => VendorItem, (vendorItem) => vendorItem.photos)
  @JoinColumn({ name: 'vendorItemId' })
  vendorItem: VendorItem;

  @Column({
    type: 'enum',
    enum: VendorItemPhotoType,
  })
  photoType: VendorItemPhotoType;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
