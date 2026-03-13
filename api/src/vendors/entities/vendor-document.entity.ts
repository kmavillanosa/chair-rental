import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Vendor } from './vendor.entity';
import { User } from '../../users/entities/user.entity';

export enum VendorDocumentType {
  GOVERNMENT_ID = 'government_id',
  SELFIE_VERIFICATION = 'selfie_verification',
  MAYORS_PERMIT = 'mayors_permit',
  BARANGAY_PERMIT = 'barangay_permit',
  BUSINESS_LOGO = 'business_logo',
}

export enum VendorDocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_MANUAL_REVIEW = 'needs_manual_review',
}

@Entity('vendor_documents')
@Index('IDX_vendor_documents_vendor_type', ['vendorId', 'documentType'])
@Index('IDX_vendor_documents_status', ['status'])
@Index('IDX_vendor_documents_created', ['createdAt'])
export class VendorDocument {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.documents)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({
    type: 'enum',
    enum: VendorDocumentType,
  })
  documentType: VendorDocumentType;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  fileHash: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @Column({
    type: 'enum',
    enum: VendorDocumentStatus,
    default: VendorDocumentStatus.PENDING,
  })
  status: VendorDocumentStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
