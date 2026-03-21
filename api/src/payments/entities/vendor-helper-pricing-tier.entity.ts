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

@Entity('vendor_helper_pricing_tiers')
export class VendorHelperPricingTier {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  pricingConfigId: string;

  @ManyToOne(() => VendorPricingConfig, (config) => config.helperTiers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pricingConfigId' })
  pricingConfig: VendorPricingConfig;

  @Column({ type: 'int' })
  helperCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceAmount: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
