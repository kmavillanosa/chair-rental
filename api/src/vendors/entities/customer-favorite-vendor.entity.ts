import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../users/entities/user.entity';
import { Vendor } from './vendor.entity';

@Entity('customer_favorite_vendors')
@Index('IDX_customer_favorite_vendors_customer', ['customerUserId'])
@Index('IDX_customer_favorite_vendors_vendor', ['vendorId'])
@Index('IDX_customer_favorite_vendors_unique_pair', ['customerUserId', 'vendorId'], {
  unique: true,
})
export class CustomerFavoriteVendor {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  customerUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerUserId' })
  customerUser: User;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}