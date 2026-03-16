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
import { Vendor } from './vendor.entity';
import type { VendorVerificationStatus } from './vendor.entity';
import { User } from '../../users/entities/user.entity';

export enum VendorVerificationAction {
  SUBMITTED = 'submitted',
  OTP_VERIFIED = 'otp_verified',
  DUPLICATE_SIGNAL = 'duplicate_signal',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WARNING_RESET = 'warning_reset',
  FLAGGED = 'flagged',
  SUSPENDED = 'suspended',
  REACTIVATED = 'reactivated',
}

const VENDOR_VERIFICATION_STATUS_VALUES = [
  'pending_verification',
  'verified_business',
  'verified_owner',
  'rejected',
  'suspended',
] as const;

@Entity('vendor_verification_status')
@Index('IDX_vendor_verification_status_vendor_created', ['vendorId', 'createdAt'])
@Index('IDX_vendor_verification_status_status', ['status'])
export class VendorVerificationStatusEntry {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.verificationHistory)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({
    type: 'enum',
    enum: VENDOR_VERIFICATION_STATUS_VALUES,
  })
  status: VendorVerificationStatus;

  @Column({
    type: 'enum',
    enum: VendorVerificationAction,
  })
  actionType: VendorVerificationAction;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'int', default: 0 })
  riskScore: number;

  @Column({ type: 'text', nullable: true })
  duplicateSignals: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
