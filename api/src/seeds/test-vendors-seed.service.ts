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
import {
  VendorItem,
  VendorItemVerificationStatus,
} from '../vendors/entities/vendor-item.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

export interface TestVendorsSeedResult {
  usersCreated: number;
  vendorsCreated: number;
  vendorsUpdated: number;
  inventoryItemsCreated: number;
  vendorItemsCreated: number;
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
    @InjectRepository(VendorItem)
    private readonly vendorItemRepo: Repository<VendorItem>,
  ) {}

  async seed(): Promise<TestVendorsSeedResult> {
    let usersCreated = 0;
    let vendorsCreated = 0;
    let vendorsUpdated = 0;
    let inventoryItemsCreated = 0;
    let vendorItemsCreated = 0;

    const allItemTypes = await this.itemTypeRepo.find({
      where: { isActive: true },
      select: ['id', 'name', 'defaultRatePerDay'],
    });

    const monoblock = this.resolveItemTypeByKeywords(allItemTypes, ['monoblock', 'monobloc']);
    const foldingTable = this.resolveItemTypeByKeywords(allItemTypes, ['folding table', 'table folding']);
    const tent = this.resolveItemTypeByKeywords(allItemTypes, ['tent']);

    if (!monoblock || !foldingTable || !tent) {
      const missing: string[] = [];
      if (!monoblock) missing.push('Monoblock');
      if (!foldingTable) missing.push('Folding Table');
      if (!tent) missing.push('Tent');

      throw new Error(
        `Missing required item types: ${missing.join(', ')}. Run seed:catalog first.`,
      );
    }

    const itemTypesToSeed: Array<{
      itemType: ItemType;
      quantity: number;
      ratePerDay: number;
    }> = [
      { itemType: monoblock, quantity: 50, ratePerDay: Number(monoblock.defaultRatePerDay || 80) },
      { itemType: foldingTable, quantity: 30, ratePerDay: Number(foldingTable.defaultRatePerDay || 220) },
      { itemType: tent, quantity: 5, ratePerDay: Number(tent.defaultRatePerDay || 3500) },
    ];

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
        let inventoryItem = await this.inventoryItemRepo.findOne({
          where: { vendorId, itemTypeId: itemType.id },
        });

        if (!inventoryItem) {
          inventoryItem = await this.inventoryItemRepo.save(
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

        const existingVendorItem = await this.vendorItemRepo.findOne({
          where: { vendorId, inventoryItemId: inventoryItem.id },
        });

        if (!existingVendorItem) {
          await this.vendorItemRepo.save(
            this.vendorItemRepo.create({
              vendorId,
              inventoryItemId: inventoryItem.id,
              title: `${itemType.name} - Test Inventory`,
              description: `Seeded test item for ${businessName}`,
              verificationStatus: VendorItemVerificationStatus.VERIFIED,
              rejectionReason: null,
              isSuspicious: false,
            }),
          );
          vendorItemsCreated += 1;
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
      vendorItemsCreated,
      totalTestVendors,
    };
  }

  private resolveItemTypeByKeywords(itemTypes: ItemType[], keywords: string[]): ItemType | null {
    for (const itemType of itemTypes) {
      const name = (itemType.name || '').toLowerCase();
      if (keywords.some((keyword) => name.includes(keyword))) {
        return itemType;
      }
    }

    return null;
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
