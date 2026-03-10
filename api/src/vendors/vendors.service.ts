import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './entities/vendor.entity';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
  ) {}

  findAll() {
    return this.vendorsRepo.find({ relations: ['user'] });
  }

  findById(id: string) {
    return this.vendorsRepo.findOne({ where: { id }, relations: ['user'] });
  }

  findBySlug(slug: string) {
    return this.vendorsRepo.findOne({ where: { slug }, relations: ['user'] });
  }

  findByUserId(userId: string) {
    return this.vendorsRepo.findOne({ where: { userId }, relations: ['user'] });
  }

  async create(data: Partial<Vendor>) {
    const vendor = this.vendorsRepo.create(data);
    return this.vendorsRepo.save(vendor);
  }

  async update(id: string, data: Partial<Vendor>) {
    await this.vendorsRepo.update(id, data);
    return this.findById(id);
  }

  async findNearby(lat: number, lng: number, radiusKm = 50) {
    const vendors = await this.vendorsRepo.find({ where: { isActive: true, isVerified: true } });
    return vendors
      .map((v) => {
        const dist = this.haversine(lat, lng, Number(v.latitude), Number(v.longitude));
        return { ...v, distanceKm: dist };
      })
      .filter((v) => v.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async warn(id: string) {
    const vendor = await this.findById(id);
    if (!vendor) throw new NotFoundException('Vendor not found');
    vendor.warningCount += 1;
    if (vendor.warningCount >= 3) {
      const suspended = new Date();
      suspended.setDate(suspended.getDate() + 7);
      vendor.suspendedUntil = suspended;
      vendor.isActive = false;
    }
    return this.vendorsRepo.save(vendor);
  }

  async verify(id: string, isVerified: boolean) {
    await this.vendorsRepo.update(id, { isVerified });
    return this.findById(id);
  }

  async setActive(id: string, isActive: boolean) {
    await this.vendorsRepo.update(id, { isActive });
    return this.findById(id);
  }
}
