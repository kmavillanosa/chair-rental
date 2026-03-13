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
  vendorsTotal: number;
  deliveryRatesTotal: number;
}

const DEFAULT_COORDS = [
  { lat: 14.5995, lng: 120.9842 }, // Manila
  { lat: 14.6760, lng: 121.0437 }, // Quezon City
  { lat: 14.5547, lng: 121.0244 }, // Makati
  { lat: 14.5764, lng: 121.0851 }, // Pasig
  { lat: 14.4500, lng: 121.0360 }, // Muntinlupa
  { lat: 14.4793, lng: 120.8969 }, // Bacoor
];

const DISTANCE_TIERS = [5, 10, 20, 50];
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
      const existingRateKeys = new Set(
        existingRates.map(
          (rate) =>
            `${Number(rate.helpersCount)}|${Number(rate.distanceKm).toFixed(2)}`,
        ),
      );

      for (const helpersCount of HELPER_COUNTS) {
        for (const distanceKm of DISTANCE_TIERS) {
          const key = `${helpersCount}|${distanceKm.toFixed(2)}`;
          if (existingRateKeys.has(key)) continue;

          await this.deliveryRatesRepo.save(
            this.deliveryRatesRepo.create({
              vendorId: vendor.id,
              helpersCount,
              distanceKm,
              chargeAmount: this.computeCharge(distanceKm, helpersCount),
            }),
          );
          deliveryRatesCreated += 1;
          existingRateKeys.add(key);
        }
      }
    }

    return {
      vendorsUpdated,
      deliveryRatesCreated,
      vendorsTotal: await this.vendorsRepo.count(),
      deliveryRatesTotal: await this.deliveryRatesRepo.count(),
    };
  }

  private computeCharge(distanceKm: number, helpersCount: number) {
    const base = 250 + helpersCount * 140;
    const perKm = 12 + helpersCount * 5;
    return Number((base + distanceKm * perKm).toFixed(2));
  }
}