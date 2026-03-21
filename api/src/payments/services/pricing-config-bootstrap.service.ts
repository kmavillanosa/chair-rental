import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorPricingConfig } from '../entities/vendor-pricing-config.entity';
import { VendorDeliveryPricingTier } from '../entities/vendor-delivery-pricing-tier.entity';
import { VendorHelperPricingTier } from '../entities/vendor-helper-pricing-tier.entity';

interface DefaultPricingTemplate {
  delivery: {
    free_radius_km: number;
    tiers: Array<{ min: number; max: number; price: number }>;
    per_km_enabled: boolean;
    per_km_rate: number | null;
  };
  helpers: {
    enabled: boolean;
    pricing_mode: 'tiered' | 'fixed' | 'hourly';
    tiers: Array<{ count: number; price: number }>;
    hourly_rate: number | null;
    max_helpers: number;
  };
  extras: {
    waiting_fee_per_hour: number;
    night_surcharge: number;
    min_order_amount: number;
  };
}

@Injectable()
export class PricingConfigBootstrapService {
  private readonly logger = new Logger(PricingConfigBootstrapService.name);

  private readonly DEFAULT_PRICING_TEMPLATE: DefaultPricingTemplate = {
    delivery: {
      free_radius_km: 2,
      tiers: [
        { min: 3, max: 5, price: 100 },
        { min: 6, max: 10, price: 200 },
        { min: 11, max: 20, price: 400 },
        { min: 21, max: 40, price: 800 },
        { min: 41, max: 60, price: 1200 },
        { min: 61, max: 80, price: 1600 },
        { min: 81, max: 100, price: 2000 },
      ],
      per_km_enabled: false,
      per_km_rate: null,
    },
    helpers: {
      enabled: true,
      pricing_mode: 'tiered',
      tiers: [
        { count: 1, price: 500 },
        { count: 2, price: 900 },
        { count: 3, price: 1300 },
      ],
      hourly_rate: null,
      max_helpers: 3,
    },
    extras: {
      waiting_fee_per_hour: 100,
      night_surcharge: 0,
      min_order_amount: 0,
    },
  };

  constructor(
    @InjectRepository(VendorPricingConfig)
    private pricingConfigRepo: Repository<VendorPricingConfig>,
    @InjectRepository(VendorDeliveryPricingTier)
    private deliveryTierRepo: Repository<VendorDeliveryPricingTier>,
    @InjectRepository(VendorHelperPricingTier)
    private helperTierRepo: Repository<VendorHelperPricingTier>,
  ) {}

  /**
   * Creates a default pricing configuration for a newly approved vendor.
   * This is idempotent - if config already exists, it won't be recreated.
   * Called during KYC approval flow.
   */
  async bootstrapPricingConfigForVendor(vendorId: string): Promise<VendorPricingConfig> {
    // Check if config already exists (idempotent)
    const existingConfig = await this.pricingConfigRepo.findOne({
      where: { vendorId },
    });

    if (existingConfig) {
      this.logger.debug(
        `Pricing config already exists for vendor ${vendorId}, skipping bootstrap`,
      );
      return existingConfig;
    }

    try {
      // Create main config
      const template = this.DEFAULT_PRICING_TEMPLATE;
      const config = this.pricingConfigRepo.create({
        vendorId,
        deliveryFreeRadiusKm: template.delivery.free_radius_km,
        deliveryPerKmEnabled: template.delivery.per_km_enabled,
        deliveryPerKmRate: template.delivery.per_km_rate,
        helpersEnabled: template.helpers.enabled,
        helpersPricingMode: template.helpers.pricing_mode as any,
        helpersFixedPrice: null,
        helpersHourlyRate: template.helpers.hourly_rate,
        helpersMaxCount: template.helpers.max_helpers,
        waitingFeePerHour: template.extras.waiting_fee_per_hour,
        nightSurcharge: template.extras.night_surcharge,
        minOrderAmount: template.extras.min_order_amount,
        isActive: true,
        notes: 'Auto-provisioned during KYC approval',
      });

      const savedConfig = await this.pricingConfigRepo.save(config);

      // Create delivery tiers
      const deliveryTiers = template.delivery.tiers.map((tier, index) =>
        this.deliveryTierRepo.create({
          pricingConfigId: savedConfig.id,
          minDistanceKm: tier.min,
          maxDistanceKm: tier.max,
          priceAmount: tier.price,
          sortOrder: index,
        }),
      );
      await this.deliveryTierRepo.save(deliveryTiers);

      // Create helper tiers
      const helperTiers = template.helpers.tiers.map((tier, index) =>
        this.helperTierRepo.create({
          pricingConfigId: savedConfig.id,
          helperCount: tier.count,
          priceAmount: tier.price,
          sortOrder: index,
        }),
      );
      await this.helperTierRepo.save(helperTiers);

      this.logger.log(
        `Successfully bootstrapped pricing config for vendor ${vendorId}`,
      );

      // Reload config with relations
      return await this.pricingConfigRepo.findOne({
        where: { vendorId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to bootstrap pricing config for vendor ${vendorId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Resets a vendor's pricing configuration to platform defaults.
   * Used by admin if needed.
   */
  async resetPricingConfigToDefaults(vendorId: string): Promise<VendorPricingConfig> {
    const config = await this.pricingConfigRepo.findOne({
      where: { vendorId },
    });

    if (!config) {
      // If no config exists, bootstrap new one
      return this.bootstrapPricingConfigForVendor(vendorId);
    }

    // Delete existing tiers
    await this.deliveryTierRepo.delete({ pricingConfigId: config.id });
    await this.helperTierRepo.delete({ pricingConfigId: config.id });

    // Reset config to defaults
    const template = this.DEFAULT_PRICING_TEMPLATE;
    config.deliveryFreeRadiusKm = template.delivery.free_radius_km;
    config.deliveryPerKmEnabled = template.delivery.per_km_enabled;
    config.deliveryPerKmRate = template.delivery.per_km_rate;
    config.helpersEnabled = template.helpers.enabled;
    config.helpersPricingMode = template.helpers.pricing_mode as any;
    config.helpersFixedPrice = null;
    config.helpersHourlyRate = template.helpers.hourly_rate;
    config.helpersMaxCount = template.helpers.max_helpers;
    config.waitingFeePerHour = template.extras.waiting_fee_per_hour;
    config.nightSurcharge = template.extras.night_surcharge;
    config.minOrderAmount = template.extras.min_order_amount;

    const updatedConfig = await this.pricingConfigRepo.save(config);

    // Recreate default tiers
    const deliveryTiers = template.delivery.tiers.map((tier, index) =>
      this.deliveryTierRepo.create({
        pricingConfigId: updatedConfig.id,
        minDistanceKm: tier.min,
        maxDistanceKm: tier.max,
        priceAmount: tier.price,
        sortOrder: index,
      }),
    );
    await this.deliveryTierRepo.save(deliveryTiers);

    const helperTiers = template.helpers.tiers.map((tier, index) =>
      this.helperTierRepo.create({
        pricingConfigId: updatedConfig.id,
        helperCount: tier.count,
        priceAmount: tier.price,
        sortOrder: index,
      }),
    );
    await this.helperTierRepo.save(helperTiers);

    this.logger.log(
      `Successfully reset pricing config for vendor ${vendorId} to defaults`,
    );

    return await this.pricingConfigRepo.findOne({
      where: { vendorId },
    });
  }
}
