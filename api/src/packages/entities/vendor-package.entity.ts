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
import { AdminPackageTemplate } from './admin-package-template.entity';

export enum VendorPackageSource {
  ADMIN = 'admin',
  VENDOR = 'vendor',
}

export enum VendorPackageStatus {
  ELIGIBLE = 'eligible',
  AVAILABLE = 'available',
  PARTIALLY_AVAILABLE = 'partially_available',
  DISABLED = 'disabled',
}

@Entity('vendor_packages')
@Index('IDX_vendor_packages_vendor', ['vendorId'])
@Index('IDX_vendor_packages_vendor_base', ['vendorId', 'basePackageId'], {
  unique: true,
})
export class VendorPackage {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 36, nullable: true })
  basePackageId: string | null;

  @ManyToOne(() => AdminPackageTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'basePackageId' })
  basePackage: AdminPackageTemplate | null;

  @Column({ type: 'enum', enum: VendorPackageSource, default: VendorPackageSource.ADMIN })
  source: VendorPackageSource;

  @Column({ type: 'varchar', length: 160 })
  packageName: string;

  @Column({ type: 'boolean', default: false })
  hasOverride: boolean;

  @Column({ type: 'enum', enum: VendorPackageStatus, default: VendorPackageStatus.ELIGIBLE })
  status: VendorPackageStatus;

  @Column({ type: 'date', nullable: true })
  statusDate: Date | null;

  @Column({ type: 'text', nullable: true })
  overrideMetadata: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}