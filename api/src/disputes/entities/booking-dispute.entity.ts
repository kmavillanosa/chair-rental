import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Booking } from '../../bookings/entities/booking.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { BookingDisputeEvidence } from './booking-dispute-evidence.entity';

export enum BookingDisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum BookingDisputeOutcome {
  REFUND_CUSTOMER = 'refund_customer',
  RELEASE_PAYMENT_TO_VENDOR = 'release_payment_to_vendor',
  PARTIAL_REFUND = 'partial_refund',
}

@Entity('booking_disputes')
@Index('IDX_booking_disputes_booking_status', ['bookingId', 'status'])
export class BookingDispute {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'varchar', length: 36 })
  openedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'openedByUserId' })
  openedByUser: User;

  @Column({ type: 'enum', enum: UserRole })
  openedByRole: UserRole;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: BookingDisputeStatus, default: BookingDisputeStatus.OPEN })
  status: BookingDisputeStatus;

  @Column({ type: 'enum', enum: BookingDisputeOutcome, nullable: true })
  outcome: BookingDisputeOutcome;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  refundAmount: number;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  resolvedByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolvedByUserId' })
  resolvedByUser: User;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;

  @OneToMany(() => BookingDisputeEvidence, (evidence) => evidence.dispute)
  evidence: BookingDisputeEvidence[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}