import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { VendorDeliveryPricingTier } from './vendor-delivery-pricing-tier.entity';
import { VendorHelperPricingTier } from './vendor-helper-pricing-tier.entity';

@Entity('vendor_pricing_configs')
export class VendorPricingConfig {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  // DELIVERY SETTINGS
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2 })
  deliveryFreeRadiusKm: number;

  @Column({ type: 'boolean', default: false })
  deliveryPerKmEnabled: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deliveryPerKmRate: number | null;

  // HELPER SETTINGS
  @Column({ type: 'boolean', default: true })
  helpersEnabled: boolean;

  @Column({
    type: 'enum',
    enum: ['tiered', 'fixed', 'hourly'],
    default: 'tiered',
  })
  helpersPricingMode: 'tiered' | 'fixed' | 'hourly';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  helpersFixedPrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  helpersHourlyRate: number | null;

  @Column({ type: 'int', default: 3 })
  helpersMaxCount: number;

  // EXTRAS
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 100 })
  waitingFeePerHour: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  nightSurcharge: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  minOrderAmount: number;

  // STATUS
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(
    () => VendorDeliveryPricingTier,
    (tier) => tier.pricingConfig,
    { cascade: true, eager: true },
  )
  deliveryTiers: VendorDeliveryPricingTier[];

  @OneToMany(
    () => VendorHelperPricingTier,
    (tier) => tier.pricingConfig,
    { cascade: true, eager: true },
  )
  helperTiers: VendorHelperPricingTier[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
