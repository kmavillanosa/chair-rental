import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../users/entities/user.entity';
import { VendorDocument } from './vendor-document.entity';
import { VendorVerificationStatusEntry } from './vendor-verification-status.entity';
import { VendorItem } from './vendor-item.entity';

export enum VendorType {
  REGISTERED_BUSINESS = 'registered_business',
  INDIVIDUAL_OWNER = 'individual_owner',
}

export enum BusinessRegistrationType {
  DTI = 'dti',
  SEC = 'sec',
}

export enum VendorRegistrationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum VendorKycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum VendorVerificationStatus {
  PENDING_VERIFICATION = 'pending_verification',
  VERIFIED_BUSINESS = 'verified_business',
  VERIFIED_OWNER = 'verified_owner',
  REJECTED = 'rejected',
}

@Entity('vendors')
@Index('IDX_vendors_user_id', ['userId'], { unique: true })
@Index('IDX_vendors_status_type', ['verificationStatus', 'vendorType'])
@Index('IDX_vendors_active_verified', ['isActive', 'isVerified'])
@Index('IDX_vendors_business_reg_number', ['businessRegistrationNumber'])
@Index('IDX_vendors_government_id_number', ['governmentIdNumber'])
@Index('IDX_vendors_phone', ['phone'])
@Index('IDX_vendors_device_fingerprint', ['deviceFingerprintHash'])
export class Vendor {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: VendorType,
    default: VendorType.REGISTERED_BUSINESS,
  })
  vendorType: VendorType;

  @Column()
  businessName: string;

  @Column({
    type: 'enum',
    enum: BusinessRegistrationType,
    nullable: true,
  })
  businessRegistrationType: BusinessRegistrationType;

  @Column({ nullable: true })
  businessRegistrationNumber: string;

  @Column({ nullable: true })
  birTin: string;

  @Column({ nullable: true })
  ownerFullName: string;

  @Column({ nullable: true })
  governmentIdNumber: string;

  @Column()
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'datetime', nullable: true })
  phoneOtpVerifiedAt: Date;

  @Column({ nullable: true })
  socialMediaLink: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({
    type: 'enum',
    enum: VendorRegistrationStatus,
    default: VendorRegistrationStatus.PENDING,
  })
  registrationStatus: VendorRegistrationStatus;

  @Column({
    type: 'enum',
    enum: VendorKycStatus,
    default: VendorKycStatus.PENDING,
  })
  kycStatus: VendorKycStatus;

  @Column({
    type: 'enum',
    enum: VendorVerificationStatus,
    default: VendorVerificationStatus.PENDING_VERIFICATION,
  })
  verificationStatus: VendorVerificationStatus;

  @Column({ nullable: true })
  verificationBadge: string;

  @Column({ nullable: true })
  kycDocumentUrl: string;

  @Column({ type: 'text', nullable: true })
  kycNotes: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'datetime', nullable: true })
  kycSubmittedAt: Date;

  @Column({ nullable: true })
  reviewedByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  deviceFingerprintHash: string;

  @Column({ type: 'int', default: 0 })
  duplicateRiskScore: number;

  @Column({ type: 'text', nullable: true })
  duplicateSignals: string;

  @Column({ default: false })
  isSuspicious: boolean;

  @Column({ type: 'text', nullable: true })
  suspiciousReason: string;

  @Column({ nullable: true })
  faceMatchStatus: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  faceMatchScore: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10.00 })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ default: 0 })
  warningCount: number;

  @Column({ nullable: true })
  suspendedUntil: Date;

  @OneToMany(() => VendorDocument, (document) => document.vendor)
  documents: VendorDocument[];

  @OneToMany(() => VendorVerificationStatusEntry, (entry) => entry.vendor)
  verificationHistory: VendorVerificationStatusEntry[];

  @OneToMany(() => VendorItem, (item) => item.vendor)
  verificationItems: VendorItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
