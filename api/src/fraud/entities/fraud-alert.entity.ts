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
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum FraudAlertType {
  BOOKING_RISK = 'booking_risk',
  OFF_PLATFORM_MESSAGE = 'off_platform_message',
  VENDOR_KYC = 'vendor_kyc',
  DISPUTE = 'dispute',
  LOW_RATING_VENDOR = 'low_rating_vendor',
  IP_REUSE = 'ip_reuse',
  CANCELLATION_PATTERN = 'cancellation_pattern',
  UNUSUAL_BOOKING_FREQUENCY = 'unusual_booking_frequency',
}

export enum FraudAlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum FraudAlertStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('fraud_alerts')
@Index('IDX_fraud_alerts_status_created', ['status', 'createdAt'])
@Index('IDX_fraud_alerts_type_severity', ['type', 'severity'])
export class FraudAlert {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'enum', enum: FraudAlertType })
  type: FraudAlertType;

  @Column({ type: 'enum', enum: FraudAlertSeverity, default: FraudAlertSeverity.MEDIUM })
  severity: FraudAlertSeverity;

  @Column({ type: 'enum', enum: FraudAlertStatus, default: FraudAlertStatus.OPEN })
  status: FraudAlertStatus;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 36, nullable: true })
  vendorId: string;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 36, nullable: true })
  bookingId: string;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'varchar', length: 36, nullable: true })
  messageId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  disputeId: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}