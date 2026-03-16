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

export enum BookingDocumentType {
  CONTRACT = 'contract',
  RECEIPT = 'receipt',
}

export enum BookingDocumentIssuedTo {
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  BOTH = 'both',
}

@Entity('booking_documents')
@Index('IDX_booking_documents_booking_type_issued_to', ['bookingId', 'documentType', 'issuedTo'], {
  unique: true,
})
@Index('IDX_booking_documents_generated_at', ['generatedAt'])
export class BookingDocument {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.documents)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'enum', enum: BookingDocumentType })
  documentType: BookingDocumentType;

  @Column({ type: 'enum', enum: BookingDocumentIssuedTo })
  issuedTo: BookingDocumentIssuedTo;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'varchar', length: 180 })
  fileName: string;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 128 })
  fileHash: string;

  @Column({ type: 'varchar', length: 128 })
  signature: string;

  @Column({ type: 'varchar', length: 32, default: 'HMAC-SHA256' })
  signatureAlgorithm: string;

  @Column({ type: 'varchar', length: 128 })
  signaturePayloadHash: string;

  @Column({ type: 'datetime' })
  generatedAt: Date;

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
