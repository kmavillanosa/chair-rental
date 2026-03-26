import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Vendor,
  VendorKycStatus,
  VendorRegistrationStatus,
} from '../vendors/entities/vendor.entity';
import { DeliveryRate } from '../payments/entities/delivery-rate.entity';

export interface VendorDistanceSeedResult {
  vendorsUpdated: number;
  deliveryRatesCreated: number;
  deliveryRatesUpdated: number;
  deliveryRatesDeleted: number;
  vendorsTotal: number;
  deliveryRatesTotal: number;
}

const DEFAULT_COORDS = [
  { lat: 9.7392, lng: 118.7353 }, // Puerto Princesa City
  { lat: 9.3073, lng: 118.4241 }, // Narra, Palawan
  { lat: 10.3229, lng: 119.3456 }, // Roxas, Palawan
  { lat: 10.5507, lng: 119.2740 }, // San Vicente, Palawan
  { lat: 11.2026, lng: 119.4170 }, // El Nido, Palawan
  { lat: 12.0010, lng: 120.2040 }, // Coron, Palawan
];

const DISTANCE_TIERS = [3, 5, 8, 10, 15, 20, 30, 40, 50];
const HELPER_COUNTS = [0, 1, 2, 3];

@Injectable()
export class VendorDistanceSeedService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
    @InjectRepository(DeliveryRate)
    private readonly deliveryRatesRepo: Repository<DeliveryRate>,
  ) {}

  async seed(): Promise<VendorDistanceSeedResult> {
    const vendors = await this.vendorsRepo.find();
    let vendorsUpdated = 0;
    let deliveryRatesCreated = 0;
    let deliveryRatesUpdated = 0;
    let deliveryRatesDeleted = 0;

    for (let index = 0; index < vendors.length; index += 1) {
      const vendor = vendors[index];
      const coords = DEFAULT_COORDS[index % DEFAULT_COORDS.length];
      const offset = (index % 5) * 0.0035;

      const patch: Partial<Vendor> = {};

      if (vendor.latitude == null || vendor.longitude == null) {
        patch.latitude = Number((coords.lat + offset).toFixed(7));
        patch.longitude = Number((coords.lng + offset).toFixed(7));
      }

      if (vendor.isVerified) {
        if (vendor.registrationStatus !== VendorRegistrationStatus.APPROVED) {
          patch.registrationStatus = VendorRegistrationStatus.APPROVED;
        }
        if (vendor.kycStatus !== VendorKycStatus.APPROVED) {
          patch.kycStatus = VendorKycStatus.APPROVED;
        }
      }

      if (Object.keys(patch).length) {
        await this.vendorsRepo.update(vendor.id, patch);
        vendorsUpdated += 1;
      }

      const existingRates = await this.deliveryRatesRepo.find({
        where: { vendorId: vendor.id },
      });
      const existingRatesByKey = new Map<string, DeliveryRate>();
      for (const rate of existingRates) {
        existingRatesByKey.set(
          `${Number(rate.helpersCount)}|${Number(rate.distanceKm).toFixed(2)}`,
          rate,
        );
      }

      const desiredRateKeys = new Set<string>();

      for (const helpersCount of HELPER_COUNTS) {
        for (const distanceKm of DISTANCE_TIERS) {
          const key = `${helpersCount}|${distanceKm.toFixed(2)}`;
          desiredRateKeys.add(key);
          const chargeAmount = this.computeCharge(distanceKm, helpersCount);
          const existingRate = existingRatesByKey.get(key);

          if (existingRate) {
            if (Number(existingRate.chargeAmount) !== chargeAmount) {
              await this.deliveryRatesRepo.update(existingRate.id, {
                chargeAmount,
              });
              deliveryRatesUpdated += 1;
            }
            continue;
          }

          await this.deliveryRatesRepo.save(
            this.deliveryRatesRepo.create({
              vendorId: vendor.id,
              helpersCount,
              distanceKm,
              chargeAmount,
            }),
          );
          deliveryRatesCreated += 1;
        }
      }

      for (const [existingKey, existingRate] of existingRatesByKey) {
        if (desiredRateKeys.has(existingKey)) continue;
        await this.deliveryRatesRepo.delete(existingRate.id);
        deliveryRatesDeleted += 1;
      }
    }

    return {
      vendorsUpdated,
      deliveryRatesCreated,
      deliveryRatesUpdated,
      deliveryRatesDeleted,
      vendorsTotal: await this.vendorsRepo.count(),
      deliveryRatesTotal: await this.deliveryRatesRepo.count(),
    };
  }

  private computeCharge(distanceKm: number, helpersCount: number) {
    const normalizedHelpers = Math.max(0, Math.min(3, helpersCount));

    const baseByHelper = [120, 470, 820, 1170];
    const perKmByHelper = [20, 22, 24, 26];

    let charge =
      baseByHelper[normalizedHelpers] +
      distanceKm * perKmByHelper[normalizedHelpers];

    if (distanceKm > 20) {
      charge += (distanceKm - 20) * 6;
    }

    if (distanceKm > 35) {
      charge += (distanceKm - 35) * 8;
    }

    // Round to nearest PHP 10 for cleaner pricing tiers.
    return Math.max(120, Math.round(charge / 10) * 10);
  }
}