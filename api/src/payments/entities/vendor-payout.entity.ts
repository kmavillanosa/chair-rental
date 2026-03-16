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
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum VendorPayoutStatus {
  PENDING = 'pending',
  HELD = 'held',
  READY = 'ready',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

@Entity('vendor_payouts')
@Index('IDX_vendor_payouts_vendor_status', ['vendorId', 'status'])
@Index('IDX_vendor_payouts_booking', ['bookingId'], { unique: true })
export class VendorPayout {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 36 })
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformFeeAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  netAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  depositHeldAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  outstandingBalanceAmount: number;

  @Column({ type: 'enum', enum: VendorPayoutStatus, default: VendorPayoutStatus.PENDING })
  status: VendorPayoutStatus;

  @Column({ type: 'datetime', nullable: true })
  releaseOn: Date;

  @Column({ type: 'datetime', nullable: true })
  heldAt: Date;

  @Column({ type: 'datetime', nullable: true })
  releasedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  disputeLockedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}