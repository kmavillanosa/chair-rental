import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorPricingConfig } from '../entities/vendor-pricing-config.entity';

export interface PricingQuote {
  baseRentalCost: number;
  deliveryFee: number;
  helperFee: number;
  waitingFee: number;
  nightSurcharge: number;
  totalCost: number;
  breakdown: {
    distance: { km: number; appliedTier?: { min: number; max: number; price: number } };
    helpers: { count: number; appliedTier?: { count: number; price: number } };
  };
  notes: string[];
}

@Injectable()
export class PricingCalculationService {
  private readonly logger = new Logger(PricingCalculationService.name);

  constructor(
    @InjectRepository(VendorPricingConfig)
    private pricingConfigRepo: Repository<VendorPricingConfig>,
  ) {}

  /**
   * Calculate a complete pricing quote for a booking.
   * Server-side authoritative calculation.
   */
  async calculateQuote(
    vendorId: string,
    baseRentalCost: number,
    distanceKm: number,
    helperCount: number = 0,
    waitingHours: number = 0,
    isNightDelivery: boolean = false,
  ): Promise<PricingQuote> {
    const config = await this.pricingConfigRepo.findOne({
      where: { vendorId },
      relations: { deliveryTiers: true, helperTiers: true },
    });

    if (!config) {
      throw new BadRequestException(
        `Pricing configuration not found for vendor ${vendorId}`,
      );
    }

    const notes: string[] = [];
    let deliveryFee = 0;
    let helperFee = 0;
    let waitingFee = 0;
    let nightSurcharge = 0;
    const breakdown = {
      distance: { km: distanceKm, appliedTier: undefined },
      helpers: { count: helperCount, appliedTier: undefined },
    };

    const freeRadiusKm = Number(config.deliveryFreeRadiusKm || 0);

    // ===== DELIVERY FEE CALCULATION =====
    if (distanceKm <= freeRadiusKm) {
      deliveryFee = 0;
      notes.push(`Free delivery (within ${freeRadiusKm}km radius)`);
    } else {
      // Delivery is chargeable
      if (config.deliveryPerKmEnabled && config.deliveryPerKmRate) {
        // Per-km pricing
        const perKmRate = Number(config.deliveryPerKmRate || 0);
        deliveryFee = (distanceKm - freeRadiusKm) * perKmRate;
        notes.push(
          `Per-km pricing: ₱${perKmRate}/km × ${(distanceKm - freeRadiusKm).toFixed(1)}km`,
        );
      } else {
        // Tiered pricing
        const applicableTier = this.findApplicableDeliveryTier(
          config.deliveryTiers,
          distanceKm,
        );

        if (applicableTier) {
          deliveryFee = Number(applicableTier.priceAmount || 0);
          breakdown.distance.appliedTier = {
            min: Number(applicableTier.minDistanceKm || 0),
            max: Number(applicableTier.maxDistanceKm || 0),
            price: Number(applicableTier.priceAmount || 0),
          };
          notes.push(
            `Delivery tier: ${applicableTier.minDistanceKm}–${applicableTier.maxDistanceKm}km @ ₱${applicableTier.priceAmount}`,
          );
        } else {
          throw new BadRequestException(
            `No delivery tier matches distance ${distanceKm}km. Max coverage: ${
              config.deliveryTiers?.[config.deliveryTiers.length - 1]?.maxDistanceKm || 'N/A'
            }km`,
          );
        }
      }
    }

    // ===== HELPER FEE CALCULATION =====
    if (config.helpersEnabled && helperCount > 0) {
      if (helperCount > config.helpersMaxCount) {
        throw new BadRequestException(
          `Maximum ${config.helpersMaxCount} helpers allowed; requested ${helperCount}`,
        );
      }

      if (config.helpersPricingMode === 'tiered') {
        const applicableTier = this.findApplicableHelperTier(
          config.helperTiers,
          helperCount,
        );

        if (applicableTier) {
          helperFee = Number(applicableTier.priceAmount || 0);
          breakdown.helpers.appliedTier = {
            count: Number(applicableTier.helperCount || 0),
            price: Number(applicableTier.priceAmount || 0),
          };
          notes.push(`Helper tier: ${applicableTier.helperCount} helpers @ ₱${applicableTier.priceAmount}`);
        } else {
          throw new BadRequestException(
            `No helper tier available for ${helperCount} helpers`,
          );
        }
      } else if (config.helpersPricingMode === 'fixed') {
        const helpersFixedPrice = Number(config.helpersFixedPrice || 0);
        helperFee = helpersFixedPrice * helperCount;
        notes.push(`Fixed pricing: ₱${helpersFixedPrice} × ${helperCount} helpers`);
      } else if (config.helpersPricingMode === 'hourly') {
        const helpersHourlyRate = Number(config.helpersHourlyRate || 0);
        helperFee = helpersHourlyRate * helperCount * (waitingHours || 1);
        notes.push(
          `Hourly pricing: ₱${helpersHourlyRate}/hour × ${helperCount} helpers × ${waitingHours || 1} hours`,
        );
      }
    } else if (helperCount > 0 && !config.helpersEnabled) {
      throw new BadRequestException(`Helpers are not offered by this vendor`);
    }

    // ===== ADDITIONAL FEES =====
    const waitingFeePerHour = Number(config.waitingFeePerHour || 0);
    if (waitingHours > 0 && waitingFeePerHour > 0) {
      waitingFee = waitingFeePerHour * waitingHours;
      notes.push(`Waiting time: ₱${waitingFeePerHour}/hour × ${waitingHours}hours`);
    }

    const nightSurchargeAmount = Number(config.nightSurcharge || 0);
    if (isNightDelivery && nightSurchargeAmount > 0) {
      nightSurcharge = nightSurchargeAmount;
      notes.push(`Night delivery surcharge: ₱${nightSurchargeAmount}`);
    }

    // ===== MINIMUM ORDER CHECK =====
    const subtotal = baseRentalCost + deliveryFee + helperFee + waitingFee + nightSurcharge;
    const minOrderAmount = Number(config.minOrderAmount || 0);
    if (minOrderAmount > subtotal) {
      throw new BadRequestException(
        `Minimum order amount is ₱${minOrderAmount}; current total is ₱${subtotal.toFixed(2)}`,
      );
    }

    return {
      baseRentalCost,
      deliveryFee,
      helperFee,
      waitingFee,
      nightSurcharge,
      totalCost: subtotal,
      breakdown,
      notes,
    };
  }

  /**
   * Find the delivery tier that applies to the given distance.
   * Returns the tier where: distance >= minDistanceKm and distance <= maxDistanceKm
   */
  private findApplicableDeliveryTier(tiers: any[], distanceKm: number) {
    if (!tiers || tiers.length === 0) return null;

    const sortedTiers = [...tiers].sort(
      (a, b) => Number(a.minDistanceKm) - Number(b.minDistanceKm),
    );

    for (const tier of sortedTiers) {
      const min = parseFloat(tier.minDistanceKm.toString());
      const max = parseFloat(tier.maxDistanceKm.toString());

      if (distanceKm >= min && distanceKm <= max) {
        return tier;
      }
    }

    return null;
  }

  /**
   * Find the helper tier that applies to the given helper count.
   * Returns the tier where: helperCount >= tier.count
   * (closest match with helper count <= requested count)
   */
  private findApplicableHelperTier(tiers: any[], helperCount: number) {
    if (!tiers || tiers.length === 0) return null;

    const sortedTiers = [...tiers]
      .sort((a, b) => Number(a.helperCount) - Number(b.helperCount))
      .reverse();

    for (const tier of sortedTiers) {
      if (helperCount >= tier.helperCount) {
        return tier;
      }
    }

    return null;
  }
}
