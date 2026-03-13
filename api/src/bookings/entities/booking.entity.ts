import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert,
  ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from '../../users/entities/user.entity';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { BookingItem } from './booking-item.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum BookingPaymentStatus {
  UNPAID = 'unpaid',
  CHECKOUT_PENDING = 'checkout_pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('bookings')
export class Booking {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  customerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  deliveryAddress: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLatitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLongitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryCharge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  serviceCharge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  platformFee: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: BookingPaymentStatus,
    default: BookingPaymentStatus.UNPAID,
  })
  paymentStatus: BookingPaymentStatus;

  @Column({ nullable: true })
  paymentProvider: string;

  @Column({ nullable: true })
  paymentReference: string;

  @Column({ nullable: true })
  paymentCheckoutSessionId: string;

  @Column({ type: 'text', nullable: true })
  paymentCheckoutUrl: string;

  @Column({ type: 'datetime', nullable: true })
  paymentPaidAt: Date;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'varchar', length: 36, nullable: true })
  cancellationRequestedByUserId: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  cancellationRequestedByRole: UserRole;

  @Column({ type: 'varchar', length: 80, nullable: true })
  cancellationPolicyCode: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  cancellationRefundPercent: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cancellationRefundAmount: number;

  @OneToMany(() => BookingItem, (item) => item.booking, { cascade: true })
  items: BookingItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
