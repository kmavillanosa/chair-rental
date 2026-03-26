import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { User, UserRole } from '../users/entities/user.entity';
import {
  BusinessRegistrationType,
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
import { DeliveryRate } from '../payments/entities/delivery-rate.entity';
import { VendorPricingConfig } from '../payments/entities/vendor-pricing-config.entity';
import { VendorDeliveryPricingTier } from '../payments/entities/vendor-delivery-pricing-tier.entity';
import { VendorHelperPricingTier } from '../payments/entities/vendor-helper-pricing-tier.entity';

export interface TestVendorsSeedResult {
  usersCreated: number;
  vendorsCreated: number;
  vendorsUpdated: number;
  inventoryItemsCreated: number;
  vendorItemsCreated: number;
  deliveryRatesCreated: number;
  deliveryRatesUpdated: number;
  deliveryRatesDeleted: number;
  pricingConfigsCreated: number;
  pricingConfigsUpdated: number;
  deliveryPricingTiersWritten: number;
  helperPricingTiersWritten: number;
  totalTestVendors: number;
}

type VendorPriceProfile = {
  chair: number;
  table: number;
  tent: number;
  balloonArch: number;
  lights: number;
  photobooth: number;
};

type TestVendorIdentity = {
  businessName: string;
  ownerName: string;
};

type TestVendorSeedInput = {
  lat: number;
  lng: number;
  prices: VendorPriceProfile;
};

type SeedItemDefinition = {
  itemType: ItemType;
  quantity: number;
  ratePerDay: number;
  condition: string;
  color: string;
  title: string;
  description: string;
};

type ResolvedSeedItemTypes = {
  chair: ItemType;
  table: ItemType;
  tent: ItemType;
  balloonArch: ItemType;
  lights: ItemType;
  photobooth: ItemType;
};

type DeliveryRateDefinition = {
  helpersCount: number;
  distanceKm: number;
  chargeAmount: number;
};

type PricingConfigSeedDefinition = {
  config: Partial<VendorPricingConfig>;
  deliveryTiers: Array<Partial<VendorDeliveryPricingTier>>;
  helperTiers: Array<Partial<VendorHelperPricingTier>>;
};

const TEST_VENDOR_IDENTITIES: TestVendorIdentity[] = [
  { businessName: 'Dela Cruz Event Rentals',     ownerName: 'Ramon Dela Cruz' },
  { businessName: 'Santos Party Supplies',        ownerName: 'Maricel Santos' },
  { businessName: 'Reyes Tent & Table Rental',    ownerName: 'Eduardo Reyes' },
  { businessName: 'Garcia Events & Catering Supply', ownerName: 'Lorna Garcia' },
  { businessName: 'Mendoza Event Services',       ownerName: 'Benito Mendoza' },
  { businessName: 'Lim Brothers Party Rentals',   ownerName: 'Jerome Lim' },
  { businessName: 'Aquino Rental Solutions',      ownerName: 'Natividad Aquino' },
  { businessName: 'Flores Occasions Rental',      ownerName: 'Ricky Flores' },
  { businessName: 'Bautista Event Supplies',      ownerName: 'Glenda Bautista' },
  { businessName: 'Villanueva Party Needs',       ownerName: 'Alfredo Villanueva' },
  { businessName: 'Ramos Tent & Chair Hire',      ownerName: 'Josefina Ramos' },
  { businessName: 'Castillo Fiesta Rentals',      ownerName: 'Dante Castillo' },
  { businessName: 'Torres Event Equipment',       ownerName: 'Marilou Torres' },
  { businessName: 'Morales Party Center',         ownerName: 'Ernesto Morales' },
  { businessName: 'Navarro Celebrations Supply',  ownerName: 'Corazon Navarro' },
  { businessName: 'Pascual Venue & Linen Rental', ownerName: 'Rodrigo Pascual' },
  { businessName: 'Salazar Event Hire',           ownerName: 'Teresita Salazar' },
  { businessName: 'Cruz Complete Event Needs',    ownerName: 'Ferdinand Cruz' },
  { businessName: 'Espiritu Party Essentials',    ownerName: 'Anita Espiritu' },
  { businessName: 'Soriano Rental & Events',      ownerName: 'Roberto Soriano' },
];

const TEST_VENDOR_SEED_INPUTS: TestVendorSeedInput[] = [
  // Rizal Avenue commercial strip (lng 118.742+ safely inland of Puerto Princesa Bay)
  { lat: 9.7345, lng: 118.7425, prices: { chair: 15, table: 80, tent: 600, balloonArch: 1200, lights: 400, photobooth: 2500 } },
  { lat: 9.7362, lng: 118.7448, prices: { chair: 12, table: 70, tent: 550, balloonArch: 1300, lights: 450, photobooth: 2600 } },
  { lat: 9.7378, lng: 118.7435, prices: { chair: 18, table: 90, tent: 700, balloonArch: 1500, lights: 500, photobooth: 2800 } },
  { lat: 9.7392, lng: 118.7462, prices: { chair: 14, table: 85, tent: 650, balloonArch: 1250, lights: 420, photobooth: 2700 } },
  { lat: 9.7405, lng: 118.7478, prices: { chair: 16, table: 78, tent: 620, balloonArch: 1400, lights: 480, photobooth: 2650 } },
  // San Pedro / Manggagawa district
  { lat: 9.7418, lng: 118.7455, prices: { chair: 13, table: 72, tent: 580, balloonArch: 1350, lights: 430, photobooth: 2550 } },
  { lat: 9.7430, lng: 118.7442, prices: { chair: 15, table: 88, tent: 690, balloonArch: 1450, lights: 470, photobooth: 2750 } },
  { lat: 9.7442, lng: 118.7468, prices: { chair: 17, table: 95, tent: 720, balloonArch: 1550, lights: 500, photobooth: 2900 } },
  { lat: 9.7455, lng: 118.7452, prices: { chair: 14, table: 80, tent: 610, balloonArch: 1250, lights: 420, photobooth: 2600 } },
  { lat: 9.7465, lng: 118.7480, prices: { chair: 16, table: 85, tent: 650, balloonArch: 1400, lights: 450, photobooth: 2750 } },
  // Extension Milagrosa / Sta. Monica inland stretch
  { lat: 9.7415, lng: 118.7495, prices: { chair: 13, table: 75, tent: 600, balloonArch: 1300, lights: 430, photobooth: 2650 } },
  { lat: 9.7400, lng: 118.7512, prices: { chair: 15, table: 80, tent: 620, balloonArch: 1350, lights: 440, photobooth: 2700 } },
  { lat: 9.7385, lng: 118.7498, prices: { chair: 17, table: 90, tent: 680, balloonArch: 1500, lights: 480, photobooth: 2850 } },
  { lat: 9.7370, lng: 118.7525, prices: { chair: 14, table: 78, tent: 610, balloonArch: 1380, lights: 450, photobooth: 2650 } },
  { lat: 9.7355, lng: 118.7508, prices: { chair: 16, table: 82, tent: 640, balloonArch: 1420, lights: 460, photobooth: 2700 } },
  // Northern barangay inland areas (Barangay 3-6 corridor)
  { lat: 9.7438, lng: 118.7515, prices: { chair: 15, table: 80, tent: 630, balloonArch: 1370, lights: 450, photobooth: 2680 } },
  { lat: 9.7450, lng: 118.7498, prices: { chair: 13, table: 75, tent: 600, balloonArch: 1300, lights: 420, photobooth: 2600 } },
  { lat: 9.7462, lng: 118.7532, prices: { chair: 16, table: 85, tent: 650, balloonArch: 1450, lights: 470, photobooth: 2750 } },
  { lat: 9.7475, lng: 118.7515, prices: { chair: 14, table: 80, tent: 620, balloonArch: 1350, lights: 440, photobooth: 2680 } },
  { lat: 9.7488, lng: 118.7548, prices: { chair: 17, table: 90, tent: 700, balloonArch: 1500, lights: 500, photobooth: 2800 } },
];

const VEHICLE_TYPES = [
  'Mitsubishi L300 van',
  'Isuzu Elf dropside truck',
  'Toyota Hilux pickup',
  'Hyundai H-100 cargo',
  'Suzuki Carry multicab',
  'Closed wing van',
  '6-wheeler light truck',
  'Canter aluminum van',
  'Nissan Urvan cargo',
  'Foton Tornado mini truck',
];

const VEHICLE_SUPPORT_TYPES = [
  'Motorcycle messenger',
  'Backup pickup',
  'Portable generator trailer',
  'Crew service van',
  'Decor support multicab',
  'Box utility van',
];

const BANK_NAMES = [
  'BDO',
  'BPI',
  'Metrobank',
  'LandBank',
  'UnionBank',
  'Security Bank',
];

const ITEM_CONDITIONS = ['Excellent', 'Like New', 'Well Maintained', 'Event Ready'];
const ITEM_COLORS = ['White', 'Black', 'Silver', 'Gold', 'Natural'];
const DELIVERY_DISTANCE_TIERS = [3, 5, 10, 15, 20, 30, 40, 50];

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
    @InjectRepository(DeliveryRate)
    private readonly deliveryRateRepo: Repository<DeliveryRate>,
    @InjectRepository(VendorPricingConfig)
    private readonly vendorPricingConfigRepo: Repository<VendorPricingConfig>,
    @InjectRepository(VendorDeliveryPricingTier)
    private readonly vendorDeliveryPricingTierRepo: Repository<VendorDeliveryPricingTier>,
    @InjectRepository(VendorHelperPricingTier)
    private readonly vendorHelperPricingTierRepo: Repository<VendorHelperPricingTier>,
  ) {}

  async seed(): Promise<TestVendorsSeedResult> {
    let usersCreated = 0;
    let vendorsCreated = 0;
    let vendorsUpdated = 0;
    let inventoryItemsCreated = 0;
    let vendorItemsCreated = 0;
    let deliveryRatesCreated = 0;
    let deliveryRatesUpdated = 0;
    let deliveryRatesDeleted = 0;
    let pricingConfigsCreated = 0;
    let pricingConfigsUpdated = 0;
    let deliveryPricingTiersWritten = 0;
    let helperPricingTiersWritten = 0;

    const itemTypes = await this.resolveRequiredItemTypes();

    for (let index = 0; index < TEST_VENDOR_SEED_INPUTS.length; index += 1) {
      const ordinal = index + 1;
      const padded = String(ordinal).padStart(2, '0');
      const profile = TEST_VENDOR_IDENTITIES[index];
      const seedInput = TEST_VENDOR_SEED_INPUTS[index];
      const email = `test-vendor-${padded}@rentalbasic.test`;
      const businessName = profile.businessName;
      const ownerName = profile.ownerName;
      const slugBase = `test-vendor-${padded}`;
      const vehicleSet = this.buildDeliveryVehicles(index);
      const phone = this.buildPhoneNumber(index);
      const bankName = BANK_NAMES[index % BANK_NAMES.length];
      const bankLast4 = String(2300 + ordinal).padStart(4, '0');

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

      const slug = await this.resolveUniqueSlug(slugBase, existingVendor?.id);

      const patch: Partial<Vendor> = {
        userId: user.id,
        vendorType: VendorType.REGISTERED_BUSINESS,
        businessName,
        businessRegistrationType:
          index % 3 === 0
            ? BusinessRegistrationType.SEC
            : BusinessRegistrationType.DTI,
        businessRegistrationNumber:
          index % 3 === 0
            ? `SEC-2026-${padded}${padded}`
            : `DTI-2026-${padded}${padded}`,
        birTin: `100-200-${String(3000 + ordinal).padStart(4, '0')}`,
        ownerFullName: ownerName,
        address: `${businessName}, Puerto Princesa, Palawan`,
        latitude: seedInput.lat,
        longitude: seedInput.lng,
        slug,
        description: this.buildVendorDescription(index, businessName),
        deliveryVehicles: vehicleSet,
        phone,
        phoneOtpVerifiedAt: this.createSeedDate(index, 9),
        socialMediaLink: `https://facebook.com/${slug}`,
        bankName,
        bankAccountName: businessName,
        bankAccountNumberMasked: `XXXXXX${bankLast4}`,
        bankAccountLast4: bankLast4,
        bankAccountHash: this.hashValue(`bank:${slug}:${bankLast4}`),
        logoUrl: null,
        registrationStatus: VendorRegistrationStatus.APPROVED,
        kycStatus: VendorKycStatus.APPROVED,
        verificationStatus: VendorVerificationStatus.VERIFIED_BUSINESS,
        verificationBadge: 'Verified Business',
        kycNotes: 'Seeded verified marketplace vendor with realistic profile and pricing.',
        kycSubmittedAt: this.createSeedDate(index, 8),
        reviewedAt: this.createSeedDate(index, 10),
        deviceFingerprintHash: this.hashValue(`device:${slug}`),
        duplicateRiskScore: 0,
        duplicateSignals: null,
        isSuspicious: false,
        suspiciousReason: null,
        faceMatchStatus: 'matched',
        faceMatchScore: 98.5,
        isVerified: true,
        isActive: true,
        isTestAccount: true,
        averageRating: Number((4.3 + (index % 5) * 0.1).toFixed(2)),
        totalRatings: 12 + index * 3,
        lowRatingFlag: false,
        successfulCompletedOrders: 18 + index * 4,
        commissionRate: 10,
        balance: 0,
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

      const inventoryDefinitions = this.buildInventorySeedDefinitions(
        index,
        businessName,
        itemTypes,
        seedInput.prices,
      );

      for (const definition of inventoryDefinitions) {
        let inventoryItem = await this.inventoryItemRepo.findOne({
          where: { vendorId, itemTypeId: definition.itemType.id },
        });

        if (!inventoryItem) {
          inventoryItem = await this.inventoryItemRepo.save(
            this.inventoryItemRepo.create({
              vendorId,
              itemTypeId: definition.itemType.id,
              quantity: definition.quantity,
              availableQuantity: definition.quantity,
              ratePerDay: definition.ratePerDay,
              condition: definition.condition,
              color: definition.color,
              pictureUrl: definition.itemType.pictureUrl || null,
            }),
          );
          inventoryItemsCreated += 1;
        } else {
          await this.inventoryItemRepo.update(inventoryItem.id, {
            quantity: definition.quantity,
            availableQuantity: definition.quantity,
            ratePerDay: definition.ratePerDay,
            condition: definition.condition,
            color: definition.color,
            pictureUrl: definition.itemType.pictureUrl || inventoryItem.pictureUrl || null,
          });
          inventoryItem.quantity = definition.quantity;
          inventoryItem.availableQuantity = definition.quantity;
          inventoryItem.ratePerDay = definition.ratePerDay;
        }

        const existingVendorItem = await this.vendorItemRepo.findOne({
          where: { vendorId, inventoryItemId: inventoryItem.id },
        });

        if (!existingVendorItem) {
          await this.vendorItemRepo.save(
            this.vendorItemRepo.create({
              vendorId,
              inventoryItemId: inventoryItem.id,
              title: definition.title,
              description: definition.description,
              verificationStatus: VendorItemVerificationStatus.VERIFIED,
              rejectionReason: null,
              isSuspicious: false,
            }),
          );
          vendorItemsCreated += 1;
        } else {
          await this.vendorItemRepo.update(existingVendorItem.id, {
            title: definition.title,
            description: definition.description,
            verificationStatus: VendorItemVerificationStatus.VERIFIED,
            rejectionReason: null,
            isSuspicious: false,
          });
        }
      }

      const legacyRateResult = await this.seedLegacyDeliveryRates(
        vendorId,
        index,
        seedInput.prices,
      );
      deliveryRatesCreated += legacyRateResult.created;
      deliveryRatesUpdated += legacyRateResult.updated;
      deliveryRatesDeleted += legacyRateResult.deleted;

      const pricingConfigResult = await this.seedVendorPricingConfig(
        vendorId,
        index,
        businessName,
        seedInput.prices,
      );
      pricingConfigsCreated += pricingConfigResult.created;
      pricingConfigsUpdated += pricingConfigResult.updated;
      deliveryPricingTiersWritten += pricingConfigResult.deliveryTiersWritten;
      helperPricingTiersWritten += pricingConfigResult.helperTiersWritten;
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
      deliveryRatesCreated,
      deliveryRatesUpdated,
      deliveryRatesDeleted,
      pricingConfigsCreated,
      pricingConfigsUpdated,
      deliveryPricingTiersWritten,
      helperPricingTiersWritten,
      totalTestVendors,
    };
  }

  private async resolveRequiredItemTypes(): Promise<ResolvedSeedItemTypes> {
    const allItemTypes = await this.itemTypeRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    const photobooth =
      this.resolveItemTypeByKeywords(allItemTypes, ['photobooth', 'photo booth'])
      || await this.ensurePhotoboothItemType();

    const resolved: ResolvedSeedItemTypes = {
      chair: this.requireItemType(
        this.resolveItemTypeByKeywords(allItemTypes, ['monoblock chairs', 'monoblock', 'chair']),
        'Monoblock Chairs',
      ),
      table: this.requireItemType(
        this.resolveItemTypeByKeywords(allItemTypes, ['folding tables', 'folding table', 'table']),
        'Folding Tables',
      ),
      tent: this.requireItemType(
        this.resolveItemTypeByKeywords(allItemTypes, ['open tent', 'tent']),
        'Tent',
      ),
      balloonArch: this.requireItemType(
        this.resolveItemTypeByKeywords(allItemTypes, ['balloon arches', 'balloon arch']),
        'Balloon Arches',
      ),
      lights: this.requireItemType(
        this.resolveItemTypeByKeywords(allItemTypes, ['par lights', 'led wash lights', 'disco lights', 'lights']),
        'Lights',
      ),
      photobooth,
    };

    return resolved;
  }

  private requireItemType(itemType: ItemType | null, label: string) {
    if (!itemType) {
      throw new Error(`Missing required item type: ${label}. Run seed:catalog first.`);
    }

    return itemType;
  }

  private async ensurePhotoboothItemType(): Promise<ItemType> {
    const existing = await this.itemTypeRepo.findOne({
      where: { name: 'Photobooth Setup' },
    });

    if (existing) {
      if (!existing.isActive) {
        await this.itemTypeRepo.update(existing.id, { isActive: true });
        existing.isActive = true;
      }

      return existing;
    }

    return this.itemTypeRepo.save(
      this.itemTypeRepo.create({
        name: 'Photobooth Setup',
        description: 'Supplemental item type for demo vendor seeding.',
        defaultRatePerDay: 2700,
        eventTags: ['birthday', 'debut', 'wedding', 'corporate', 'graduation'],
        setTags: ['photo-set', 'booth-set', 'reception-set'],
        isActive: true,
      }),
    );
  }

  private buildInventorySeedDefinitions(
    index: number,
    businessName: string,
    itemTypes: ResolvedSeedItemTypes,
    prices: VendorPriceProfile,
  ): SeedItemDefinition[] {
    const chairQty = 70 + (index % 5) * 10;
    const tableQty = 12 + (index % 4) * 4;
    const tentQty = 2 + (index % 4);
    const balloonArchQty = 1 + (index % 2);
    const lightsQty = 8 + (index % 5) * 2;
    const photoboothQty = 1 + (index % 2);

    return [
      {
        itemType: itemTypes.chair,
        quantity: chairQty,
        ratePerDay: prices.chair,
        condition: ITEM_CONDITIONS[index % ITEM_CONDITIONS.length],
        color: ITEM_COLORS[index % ITEM_COLORS.length],
        title: `${itemTypes.chair.name} Package - ${businessName}`,
        description: `Clean and stackable seating package supplied by ${businessName}.`,
      },
      {
        itemType: itemTypes.table,
        quantity: tableQty,
        ratePerDay: prices.table,
        condition: ITEM_CONDITIONS[(index + 1) % ITEM_CONDITIONS.length],
        color: ITEM_COLORS[(index + 1) % ITEM_COLORS.length],
        title: `${itemTypes.table.name} Set - ${businessName}`,
        description: `Reception and dining tables prepared by ${businessName}.`,
      },
      {
        itemType: itemTypes.tent,
        quantity: tentQty,
        ratePerDay: prices.tent,
        condition: ITEM_CONDITIONS[(index + 2) % ITEM_CONDITIONS.length],
        color: 'White',
        title: `${itemTypes.tent.name} Shelter - ${businessName}`,
        description: `Weather-ready tent rental with setup crew from ${businessName}.`,
      },
      {
        itemType: itemTypes.balloonArch,
        quantity: balloonArchQty,
        ratePerDay: prices.balloonArch,
        condition: ITEM_CONDITIONS[(index + 3) % ITEM_CONDITIONS.length],
        color: 'Custom Theme',
        title: `${itemTypes.balloonArch.name} Styling - ${businessName}`,
        description: `Entrance and backdrop balloon styling service by ${businessName}.`,
      },
      {
        itemType: itemTypes.lights,
        quantity: lightsQty,
        ratePerDay: prices.lights,
        condition: ITEM_CONDITIONS[index % ITEM_CONDITIONS.length],
        color: 'RGB',
        title: `${itemTypes.lights.name} Lighting Rig - ${businessName}`,
        description: `Accent and stage lighting package configured by ${businessName}.`,
      },
      {
        itemType: itemTypes.photobooth,
        quantity: photoboothQty,
        ratePerDay: prices.photobooth,
        condition: 'Event Ready',
        color: 'Matte Black',
        title: `${itemTypes.photobooth.name} Experience - ${businessName}`,
        description: `Interactive souvenir photo booth setup operated by ${businessName}.`,
      },
    ];
  }

  private async seedLegacyDeliveryRates(
    vendorId: string,
    index: number,
    prices: VendorPriceProfile,
  ) {
    const desiredRates = this.buildLegacyDeliveryRates(index, prices);
    const existingRates = await this.deliveryRateRepo.find({ where: { vendorId } });
    const existingRateByKey = new Map<string, DeliveryRate>();

    for (const existingRate of existingRates) {
      existingRateByKey.set(this.deliveryRateKey(existingRate.helpersCount, existingRate.distanceKm), existingRate);
    }

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const desiredKeys = new Set<string>();

    for (const rate of desiredRates) {
      const key = this.deliveryRateKey(rate.helpersCount, rate.distanceKm);
      desiredKeys.add(key);

      const existingRate = existingRateByKey.get(key);
      if (!existingRate) {
        await this.deliveryRateRepo.save(
          this.deliveryRateRepo.create({
            vendorId,
            helpersCount: rate.helpersCount,
            distanceKm: rate.distanceKm,
            chargeAmount: rate.chargeAmount,
          }),
        );
        created += 1;
        continue;
      }

      if (Number(existingRate.chargeAmount) !== rate.chargeAmount) {
        await this.deliveryRateRepo.update(existingRate.id, {
          chargeAmount: rate.chargeAmount,
        });
        updated += 1;
      }
    }

    for (const [key, existingRate] of existingRateByKey.entries()) {
      if (desiredKeys.has(key)) continue;
      await this.deliveryRateRepo.delete(existingRate.id);
      deleted += 1;
    }

    return { created, updated, deleted };
  }

  private buildLegacyDeliveryRates(
    index: number,
    prices: VendorPriceProfile,
  ): DeliveryRateDefinition[] {
    const baseCharge = this.roundToTen(180 + prices.chair * 6 + prices.table * 1.6 + index * 3);
    const helperSurcharges = [0, 180, 340, 500];

    return helperSurcharges.flatMap((helperSurcharge, helpersCount) =>
      DELIVERY_DISTANCE_TIERS.map((distanceKm, distanceIndex) => ({
        helpersCount,
        distanceKm,
        chargeAmount: this.roundToTen(
          baseCharge
          + helperSurcharge
          + distanceIndex * 65
          + Math.max(0, distanceKm - 20) * 6,
        ),
      })),
    );
  }

  private async seedVendorPricingConfig(
    vendorId: string,
    index: number,
    businessName: string,
    prices: VendorPriceProfile,
  ) {
    const seedDefinition = this.buildPricingConfigSeed(index, businessName, prices);
    const existingConfig = await this.vendorPricingConfigRepo.findOne({
      where: { vendorId },
    });

    let pricingConfigId: string;
    let created = 0;
    let updated = 0;

    if (!existingConfig) {
      const saved = await this.vendorPricingConfigRepo.save(
        this.vendorPricingConfigRepo.create({
          vendorId,
          ...seedDefinition.config,
        }),
      );
      pricingConfigId = saved.id;
      created += 1;
    } else {
      pricingConfigId = existingConfig.id;
      await this.vendorPricingConfigRepo.update(existingConfig.id, seedDefinition.config);
      updated += 1;
    }

    await this.vendorDeliveryPricingTierRepo.delete({ pricingConfigId });
    await this.vendorHelperPricingTierRepo.delete({ pricingConfigId });

    const deliveryTierEntities = seedDefinition.deliveryTiers.map((tier) =>
      this.vendorDeliveryPricingTierRepo.create({ pricingConfigId, ...tier }),
    );
    const helperTierEntities = seedDefinition.helperTiers.map((tier) =>
      this.vendorHelperPricingTierRepo.create({ pricingConfigId, ...tier }),
    );

    if (deliveryTierEntities.length) {
      await this.vendorDeliveryPricingTierRepo.save(deliveryTierEntities);
    }

    if (helperTierEntities.length) {
      await this.vendorHelperPricingTierRepo.save(helperTierEntities);
    }

    return {
      created,
      updated,
      deliveryTiersWritten: deliveryTierEntities.length,
      helperTiersWritten: helperTierEntities.length,
    };
  }

  private buildPricingConfigSeed(
    index: number,
    businessName: string,
    prices: VendorPriceProfile,
  ): PricingConfigSeedDefinition {
    const deliveryFreeRadiusKm = Number((1.5 + (index % 4) * 0.5).toFixed(2));
    const baseDeliveryFee = this.roundToTen(220 + prices.chair * 5 + prices.table * 1.75);
    const helperBaseFee = this.roundToTen(280 + prices.chair * 5 + prices.lights * 0.2);

    return {
      config: {
        deliveryFreeRadiusKm,
        deliveryPerKmEnabled: false,
        deliveryPerKmRate: null,
        helpersEnabled: true,
        helpersPricingMode: 'tiered',
        helpersFixedPrice: null,
        helpersHourlyRate: null,
        helpersMaxCount: 3,
        waitingFeePerHour: this.roundToTen(120 + (index % 4) * 20),
        nightSurcharge: this.roundToTen(150 + (prices.lights - 400) * 0.4),
        minOrderAmount: this.roundToTen(400 + (index % 3) * 150),
        isActive: true,
        notes: `Seeded pricing profile for ${businessName}`,
      },
      deliveryTiers: [
        { minDistanceKm: 3, maxDistanceKm: 5, priceAmount: baseDeliveryFee, sortOrder: 0 },
        { minDistanceKm: 6, maxDistanceKm: 10, priceAmount: baseDeliveryFee + 110, sortOrder: 1 },
        { minDistanceKm: 11, maxDistanceKm: 20, priceAmount: baseDeliveryFee + 260, sortOrder: 2 },
        { minDistanceKm: 21, maxDistanceKm: 35, priceAmount: baseDeliveryFee + 480, sortOrder: 3 },
        { minDistanceKm: 36, maxDistanceKm: 50, priceAmount: baseDeliveryFee + 760, sortOrder: 4 },
      ],
      helperTiers: [
        { helperCount: 1, priceAmount: helperBaseFee, sortOrder: 0 },
        { helperCount: 2, priceAmount: helperBaseFee + 240, sortOrder: 1 },
        { helperCount: 3, priceAmount: helperBaseFee + 520, sortOrder: 2 },
      ],
    };
  }

  private buildVendorDescription(index: number, businessName: string) {
    const specialties = [
      'same-day barangay events',
      'birthday and debut styling',
      'wedding reception setups',
      'school and corporate functions',
      'full-service tent and lighting packages',
    ];

    return `${businessName} is a seeded demo vendor focused on ${specialties[index % specialties.length]} across Puerto Princesa and nearby areas.`;
  }

  private buildDeliveryVehicles(index: number) {
    const primary = VEHICLE_TYPES[index % VEHICLE_TYPES.length];
    const secondary = VEHICLE_TYPES[(index + 3) % VEHICLE_TYPES.length];
    const support = VEHICLE_SUPPORT_TYPES[index % VEHICLE_SUPPORT_TYPES.length];

    return [
      { type: primary, description: 'Primary hauling vehicle for chairs, tables, and tent frames.' },
      { type: secondary, description: 'Backup vehicle used for overflow loads and split deliveries.' },
      { type: support, description: 'Support transport for crews, styling supplies, and urgent add-ons.' },
    ];
  }

  private buildPhoneNumber(index: number) {
    return `0917${String(4100000 + index * 137).padStart(7, '0')}`;
  }

  private hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private createSeedDate(index: number, hour: number) {
    const day = String((index % 20) + 1).padStart(2, '0');
    const normalizedHour = String(hour).padStart(2, '0');
    return new Date(`2026-02-${day}T${normalizedHour}:00:00.000Z`);
  }

  private deliveryRateKey(helpersCount: number, distanceKm: number) {
    return `${Number(helpersCount)}|${Number(distanceKm).toFixed(2)}`;
  }

  private roundToTen(value: number) {
    return Math.max(50, Math.round(Number(value) / 10) * 10);
  }

  private resolveItemTypeByKeywords(itemTypes: ItemType[], keywords: string[]): ItemType | null {
    let bestMatch: { itemType: ItemType; score: number } | null = null;

    for (const itemType of itemTypes) {
      const name = (itemType.name || '').toLowerCase();

      for (const keyword of keywords.map((entry) => entry.toLowerCase())) {
        let score = 0;
        if (name === keyword) score = 3;
        else if (name.startsWith(keyword)) score = 2;
        else if (name.includes(keyword)) score = 1;

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { itemType, score };
        }
      }
    }

    return bestMatch?.itemType || null;
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
