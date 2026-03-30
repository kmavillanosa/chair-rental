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
import { User } from '../../users/entities/user.entity';
import { Vendor } from './vendor.entity';

@Entity('vendor_reviews')
@Index('IDX_vendor_reviews_vendor', ['vendorId'])
@Index('IDX_vendor_reviews_reviewer', ['reviewerUserId'])
@Index('IDX_vendor_reviews_vendor_reviewer', ['vendorId', 'reviewerUserId'], {
  unique: true,
})
export class VendorReview {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 36 })
  reviewerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewerUserId' })
  reviewerUser: User;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}