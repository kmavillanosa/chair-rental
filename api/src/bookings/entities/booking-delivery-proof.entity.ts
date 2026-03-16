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
import { Booking } from './booking.entity';
import { Vendor } from '../../vendors/entities/vendor.entity';

@Entity('booking_delivery_proofs')
@Index('IDX_booking_delivery_proofs_booking_created', ['bookingId', 'createdAt'])
export class BookingDeliveryProof {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.deliveryProofs)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 500 })
  photoUrl: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  signatureUrl: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'datetime', nullable: true })
  capturedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}