import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VendorPricingConfig } from './vendor-pricing-config.entity';

@Entity('vendor_delivery_pricing_tiers')
export class VendorDeliveryPricingTier {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pricingConfigId: string;

  @ManyToOne(() => VendorPricingConfig, (config) => config.deliveryTiers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pricingConfigId' })
  pricingConfig: VendorPricingConfig;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  minDistanceKm: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  maxDistanceKm: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceAmount: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
