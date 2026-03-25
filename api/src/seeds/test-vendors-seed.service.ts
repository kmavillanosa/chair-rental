import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import {
  Vendor,
  VendorKycStatus,
  VendorRegistrationStatus,
  VendorType,
  VendorVerificationStatus,
} from '../vendors/entities/vendor.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

export interface TestVendorsSeedResult {
  usersCreated: number;
  vendorsCreated: number;
  vendorsUpdated: number;
  inventoryItemsCreated: number;
  totalTestVendors: number;
}

const TEST_VENDOR_COORDINATES: Array<{ lat: number; lng: number }> = [
  { lat: 9.7407, lng: 118.7301 },
  { lat: 9.7420, lng: 118.7350 },
  { lat: 9.7385, lng: 118.7280 },
  { lat: 9.7452, lng: 118.7325 },
  { lat: 9.7370, lng: 118.7335 },
  { lat: 9.7465, lng: 118.7288 },
  { lat: 9.7398, lng: 118.7400 },
  { lat: 9.7435, lng: 118.7255 },
  { lat: 9.7355, lng: 118.7295 },
  { lat: 9.7478, lng: 118.7342 },
  { lat: 9.7412, lng: 118.7205 },
  { lat: 9.7368, lng: 118.7415 },
  { lat: 9.7485, lng: 118.7260 },
  { lat: 9.7390, lng: 118.7450 },
  { lat: 9.7448, lng: 118.7380 },
  { lat: 9.7375, lng: 118.7225 },
  { lat: 9.7428, lng: 118.7480 },
  { lat: 9.7350, lng: 118.7365 },
  { lat: 9.7460, lng: 118.7420 },
  { lat: 9.7380, lng: 118.7240 },
];

@Injectable()
export class TestVendorsSeedService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
    @InjectRepository(ItemType)
    private readonly itemTypeRepo: Repository<ItemType>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepo: Repository<InventoryItem>,
  ) {}

  async seed(): Promise<TestVendorsSeedResult> {
    let usersCreated = 0;
    let vendorsCreated = 0;
    let vendorsUpdated = 0;
    let inventoryItemsCreated = 0;

    // Find or get item types
    const monoblock = await this.itemTypeRepo.findOne({ where: { name: 'Monoblock' } });
    const foldingTable = await this.itemTypeRepo.findOne({ where: { name: 'Folding Table' } });
    const tent = await this.itemTypeRepo.findOne({ where: { name: 'Tent' } });

    const itemTypesToSeed = [
      { itemType: monoblock, quantity: 50, ratePerDay: monoblock?.defaultRatePerDay || 80 },
      { itemType: foldingTable, quantity: 30, ratePerDay: foldingTable?.defaultRatePerDay || 220 },
      { itemType: tent, quantity: 5, ratePerDay: tent?.defaultRatePerDay || 3500 },
    ].filter(item => item.itemType);

    for (let index = 0; index < TEST_VENDOR_COORDINATES.length; index += 1) {
      const ordinal = index + 1;
      const padded = String(ordinal).padStart(2, '0');
      const email = `test-vendor-${padded}@rentalbasic.test`;
      const businessName = `Test Vendor ${padded}`;
      const ownerName = `QA Owner ${padded}`;
      const coords = TEST_VENDOR_COORDINATES[index];

      let user = await this.usersRepo.findOne({ where: { email } });
      if (!user) {
        user = await this.usersRepo.save(
          this.usersRepo.create({
            email,
            name: ownerName,
            role: UserRole.VENDOR,
            isActive: true,
          }),
        );
        usersCreated += 1;
      } else if (user.role !== UserRole.VENDOR || !user.isActive) {
        await this.usersRepo.update(user.id, {
          role: UserRole.VENDOR,
          isActive: true,
          name: ownerName,
        });
        user = await this.usersRepo.findOne({ where: { id: user.id } });
      }

      if (!user) {
        continue;
      }

      const existingVendor = await this.vendorsRepo.findOne({
        where: { userId: user.id },
      });

      const baseSlug = `test-vendor-${padded}`;
      const slug = await this.resolveUniqueSlug(baseSlug, existingVendor?.id);

      const patch: Partial<Vendor> = {
        userId: user.id,
        vendorType: VendorType.REGISTERED_BUSINESS,
        businessName,
        ownerFullName: ownerName,
        address: `Test Location ${padded}, Puerto Princesa, Palawan`,
        latitude: coords.lat,
        longitude: coords.lng,
        slug,
        registrationStatus: VendorRegistrationStatus.APPROVED,
        kycStatus: VendorKycStatus.APPROVED,
        verificationStatus: VendorVerificationStatus.VERIFIED_BUSINESS,
        verificationBadge: 'Verified Business',
        isVerified: true,
        isActive: true,
        isTestAccount: true,
        warningCount: 0,
      };

      let vendorId: string;
      if (!existingVendor) {
        const saved = await this.vendorsRepo.save(this.vendorsRepo.create(patch));
        vendorId = saved.id;
        vendorsCreated += 1;
      } else {
        vendorId = existingVendor.id;
        await this.vendorsRepo.update(vendorId, patch);
        vendorsUpdated += 1;
      }

      // Seed inventory items for this vendor
      for (const { itemType, quantity, ratePerDay } of itemTypesToSeed) {
        const existingInventory = await this.inventoryItemRepo.findOne({
          where: { vendorId, itemTypeId: itemType.id },
        });

        if (!existingInventory) {
          await this.inventoryItemRepo.save(
            this.inventoryItemRepo.create({
              vendorId,
              itemTypeId: itemType.id,
              quantity,
              availableQuantity: quantity,
              ratePerDay,
              condition: 'New',
              color: 'Standard',
            }),
          );
          inventoryItemsCreated += 1;
        }
      }
    }

    const totalTestVendors = await this.vendorsRepo.count({
      where: { isTestAccount: true },
    });

    return {
      usersCreated,
      vendorsCreated,
      vendorsUpdated,
      inventoryItemsCreated,
      totalTestVendors,
    };
  }

  private async resolveUniqueSlug(baseSlug: string, existingVendorId?: string) {
    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.vendorsRepo.findOne({
        where: { slug: candidate },
        select: ['id'],
      });

      if (!existing || existing.id === existingVendorId) {
        return candidate;
      }

      candidate = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }
}
