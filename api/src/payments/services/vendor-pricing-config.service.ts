import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorPricingConfig } from '../entities/vendor-pricing-config.entity';
import { VendorDeliveryPricingTier } from '../entities/vendor-delivery-pricing-tier.entity';
import { VendorHelperPricingTier } from '../entities/vendor-helper-pricing-tier.entity';
import {
  DeliveryPricingTierDto,
  HelperPricingTierDto,
  UpdateVendorPricingConfigDto,
} from '../dto/update-vendor-pricing-config.dto';
import { PricingConfigBootstrapService } from './pricing-config-bootstrap.service';

@Injectable()
export class VendorPricingConfigService {
  constructor(
    @InjectRepository(VendorPricingConfig)
    private readonly pricingConfigRepo: Repository<VendorPricingConfig>,
    @InjectRepository(VendorDeliveryPricingTier)
    private readonly deliveryTierRepo: Repository<VendorDeliveryPricingTier>,
    @InjectRepository(VendorHelperPricingTier)
    private readonly helperTierRepo: Repository<VendorHelperPricingTier>,
    private readonly pricingBootstrapService: PricingConfigBootstrapService,
  ) {}

  async getOrBootstrapByVendorId(vendorId: string): Promise<VendorPricingConfig> {
    const existing = await this.pricingConfigRepo.findOne({
      where: { vendorId },
    });

    if (existing) {
      return this.normalizeAndSort(existing);
    }

    const bootstrapped = await this.pricingBootstrapService.bootstrapPricingConfigForVendor(
      vendorId,
    );
    return this.normalizeAndSort(bootstrapped);
  }

  async updateByVendorId(
    vendorId: string,
    payload: UpdateVendorPricingConfigDto,
  ): Promise<VendorPricingConfig> {
    const config = await this.getOrBootstrapByVendorId(vendorId);

    if (payload.deliveryTiers !== undefined) {
      this.validateDeliveryTiers(payload.deliveryTiers);
    }

    if (payload.helperTiers !== undefined) {
      this.validateHelperTiers(payload.helperTiers);
    }

    if (payload.deliveryFreeRadiusKm !== undefined) {
      config.deliveryFreeRadiusKm = payload.deliveryFreeRadiusKm;
    }
    if (payload.deliveryPerKmEnabled !== undefined) {
      config.deliveryPerKmEnabled = payload.deliveryPerKmEnabled;
    }
    if (payload.deliveryPerKmRate !== undefined) {
      config.deliveryPerKmRate = payload.deliveryPerKmRate;
    }

    if (payload.helpersEnabled !== undefined) {
      config.helpersEnabled = payload.helpersEnabled;
    }
    if (payload.helpersPricingMode !== undefined) {
      config.helpersPricingMode = payload.helpersPricingMode;
    }
    if (payload.helpersFixedPrice !== undefined) {
      config.helpersFixedPrice = payload.helpersFixedPrice;
    }
    if (payload.helpersHourlyRate !== undefined) {
      config.helpersHourlyRate = payload.helpersHourlyRate;
    }
    if (payload.helpersMaxCount !== undefined) {
      config.helpersMaxCount = payload.helpersMaxCount;
    }

    if (payload.waitingFeePerHour !== undefined) {
      config.waitingFeePerHour = payload.waitingFeePerHour;
    }
    if (payload.nightSurcharge !== undefined) {
      config.nightSurcharge = payload.nightSurcharge;
    }
    if (payload.minOrderAmount !== undefined) {
      config.minOrderAmount = payload.minOrderAmount;
    }

    if (payload.isActive !== undefined) {
      config.isActive = payload.isActive;
    }
    if (payload.notes !== undefined) {
      const nextNotes = String(payload.notes || '').trim();
      config.notes = nextNotes || null;
    }

    this.validateComputedConfig(config, payload);

    await this.pricingConfigRepo.save(config);

    if (payload.deliveryTiers !== undefined) {
      await this.deliveryTierRepo.delete({ pricingConfigId: config.id });
      const tiers = payload.deliveryTiers.map((tier, index) =>
        this.deliveryTierRepo.create({
          pricingConfigId: config.id,
          minDistanceKm: tier.minDistanceKm,
          maxDistanceKm: tier.maxDistanceKm,
          priceAmount: tier.priceAmount,
          sortOrder: index,
        }),
      );
      await this.deliveryTierRepo.save(tiers);
    }

    if (payload.helperTiers !== undefined) {
      await this.helperTierRepo.delete({ pricingConfigId: config.id });
      const tiers = payload.helperTiers.map((tier, index) =>
        this.helperTierRepo.create({
          pricingConfigId: config.id,
          helperCount: tier.helperCount,
          priceAmount: tier.priceAmount,
          sortOrder: index,
        }),
      );
      await this.helperTierRepo.save(tiers);
    }

    const updated = await this.pricingConfigRepo.findOne({ where: { vendorId } });
    if (!updated) {
      throw new NotFoundException(`Pricing config not found for vendor ${vendorId}`);
    }

    return this.normalizeAndSort(updated);
  }

  private validateComputedConfig(
    config: VendorPricingConfig,
    payload: UpdateVendorPricingConfigDto,
  ) {
    if (config.deliveryPerKmEnabled) {
      const rate = Number(config.deliveryPerKmRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new BadRequestException(
          'deliveryPerKmRate must be greater than 0 when deliveryPerKmEnabled is true',
        );
      }
    }

    if (config.helpersEnabled) {
      if (config.helpersPricingMode === 'fixed') {
        const fixedPrice = Number(config.helpersFixedPrice);
        if (!Number.isFinite(fixedPrice) || fixedPrice < 0) {
          throw new BadRequestException(
            'helpersFixedPrice must be set when helpersPricingMode is fixed',
          );
        }
      }

      if (config.helpersPricingMode === 'hourly') {
        const hourlyRate = Number(config.helpersHourlyRate);
        if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
          throw new BadRequestException(
            'helpersHourlyRate must be set when helpersPricingMode is hourly',
          );
        }
      }

      if (config.helpersPricingMode === 'tiered' && payload.helperTiers !== undefined) {
        const maxTierCount = Math.max(
          ...payload.helperTiers.map((tier) => Number(tier.helperCount || 0)),
        );

        if (maxTierCount > Number(config.helpersMaxCount || 0)) {
          throw new BadRequestException(
            'helpersMaxCount must be greater than or equal to the highest helperCount tier',
          );
        }
      }
    }
  }

  private validateDeliveryTiers(tiers: DeliveryPricingTierDto[]) {
    const sorted = [...tiers].sort(
      (left, right) => left.minDistanceKm - right.minDistanceKm,
    );

    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      if (current.maxDistanceKm < current.minDistanceKm) {
        throw new BadRequestException(
          `deliveryTiers[${index}] maxDistanceKm must be >= minDistanceKm`,
        );
      }

      if (index === 0) {
        continue;
      }

      const previous = sorted[index - 1];
      if (current.minDistanceKm <= previous.maxDistanceKm) {
        throw new BadRequestException(
          'Delivery tiers must not overlap. Ensure each minDistanceKm is greater than the previous maxDistanceKm.',
        );
      }
    }
  }

  private validateHelperTiers(tiers: HelperPricingTierDto[]) {
    const seen = new Set<number>();

    for (const tier of tiers) {
      if (seen.has(tier.helperCount)) {
        throw new BadRequestException(
          `Duplicate helperCount tier: ${tier.helperCount}`,
        );
      }
      seen.add(tier.helperCount);
    }
  }

  private normalizeAndSort(config: VendorPricingConfig): VendorPricingConfig {
    config.deliveryFreeRadiusKm = Number(config.deliveryFreeRadiusKm || 0);
    config.deliveryPerKmRate =
      config.deliveryPerKmRate === null || config.deliveryPerKmRate === undefined
        ? null
        : Number(config.deliveryPerKmRate);
    config.helpersFixedPrice =
      config.helpersFixedPrice === null || config.helpersFixedPrice === undefined
        ? null
        : Number(config.helpersFixedPrice);
    config.helpersHourlyRate =
      config.helpersHourlyRate === null || config.helpersHourlyRate === undefined
        ? null
        : Number(config.helpersHourlyRate);
    config.waitingFeePerHour = Number(config.waitingFeePerHour || 0);
    config.nightSurcharge = Number(config.nightSurcharge || 0);
    config.minOrderAmount = Number(config.minOrderAmount || 0);

    config.deliveryTiers = [...(config.deliveryTiers || [])]
      .map((tier) => ({
        ...tier,
        minDistanceKm: Number(tier.minDistanceKm || 0),
        maxDistanceKm: Number(tier.maxDistanceKm || 0),
        priceAmount: Number(tier.priceAmount || 0),
      }))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.minDistanceKm - right.minDistanceKm;
      }) as VendorDeliveryPricingTier[];

    config.helperTiers = [...(config.helperTiers || [])]
      .map((tier) => ({
        ...tier,
        helperCount: Number(tier.helperCount || 0),
        priceAmount: Number(tier.priceAmount || 0),
      }))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.helperCount - right.helperCount;
      }) as VendorHelperPricingTier[];

    return config;
  }
}
