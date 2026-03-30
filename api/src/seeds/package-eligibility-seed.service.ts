import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { addDays, format } from 'date-fns';
import { Vendor } from '../vendors/entities/vendor.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { AdminPackageTemplate } from '../packages/entities/admin-package-template.entity';
import { AdminPackageTemplateItem } from '../packages/entities/admin-package-template-item.entity';
import {
  VendorPackage,
  VendorPackageSource,
  VendorPackageStatus,
} from '../packages/entities/vendor-package.entity';
import {
  VendorPackageItem,
  VendorPackageItemSource,
} from '../packages/entities/vendor-package-item.entity';

type PackageSeedItem = {
  itemTypeName: string;
  requiredQty: number;
  suggestedUnitPrice?: number;
};

type AdminPackageSeedDefinition = {
  code: string;
  name: string;
  description: string;
  items: PackageSeedItem[];
};

const ADMIN_PACKAGE_SEED_DEFINITIONS: AdminPackageSeedDefinition[] = [
  {
    code: 'starter_party_core_60pax',
    name: 'Starter Party Core (60 pax)',
    description:
      'Low-complexity package intentionally aligned with seeded demo vendor inventory for quick package testing.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 60, suggestedUnitPrice: 28 },
      { itemTypeName: 'Folding tables', requiredQty: 8, suggestedUnitPrice: 300 },
      { itemTypeName: 'Open tent', requiredQty: 1, suggestedUnitPrice: 7600 },
      { itemTypeName: 'Balloon arches', requiredQty: 1, suggestedUnitPrice: 2400 },
      { itemTypeName: 'PAR lights', requiredQty: 6, suggestedUnitPrice: 520 },
    ],
  },
  {
    code: 'micro_backyard_party_12pax',
    name: 'Micro Backyard Party (12 pax)',
    description:
      'Very small party package for home celebrations, ideal for intimate gatherings around 10-12 people.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 12, suggestedUnitPrice: 28 },
      { itemTypeName: 'Folding tables', requiredQty: 2, suggestedUnitPrice: 300 },
      { itemTypeName: 'PAR lights', requiredQty: 2, suggestedUnitPrice: 520 },
    ],
  },
  {
    code: 'small_family_celebration_16pax',
    name: 'Small Family Celebration (16 pax)',
    description:
      'Small family event package for birthdays, anniversaries, and reunions with a 15-16 guest setup.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 16, suggestedUnitPrice: 28 },
      { itemTypeName: 'Folding tables', requiredQty: 3, suggestedUnitPrice: 300 },
      { itemTypeName: 'Balloon arches', requiredQty: 1, suggestedUnitPrice: 2200 },
      { itemTypeName: 'PAR lights', requiredQty: 3, suggestedUnitPrice: 520 },
    ],
  },
  {
    code: 'small_tent_party_20pax',
    name: 'Small Tent Party (20 pax)',
    description:
      'Small outdoor party package sized for around 18-20 attendees with basic shelter and ambience.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 20, suggestedUnitPrice: 28 },
      { itemTypeName: 'Folding tables', requiredQty: 3, suggestedUnitPrice: 300 },
      { itemTypeName: 'Open tent', requiredQty: 1, suggestedUnitPrice: 7600 },
      { itemTypeName: 'PAR lights', requiredQty: 4, suggestedUnitPrice: 520 },
    ],
  },
  {
    code: 'chairs_bulk_bonus_50_plus_5',
    name: 'Chair Bulk Bonus (Rent 50 + 5 Free)',
    description:
      'Single-item promo package: customer gets 55 monoblock chairs while inventory reserves all 55 units.',
    items: [
      // Use 55 required qty so stock checks reserve all delivered units.
      // Suggested unit price is set to an effective promo rate equivalent to paying for ~50 chairs.
      { itemTypeName: 'Monoblock chairs', requiredQty: 55, suggestedUnitPrice: 25.45 },
    ],
  },
  {
    code: 'tables_bulk_bonus_10_plus_1',
    name: 'Table Bulk Bonus (Rent 10 + 1 Free)',
    description:
      'Single-item promo package for folding tables with one bonus unit included in the reserved inventory.',
    items: [
      { itemTypeName: 'Folding tables', requiredQty: 11, suggestedUnitPrice: 272.73 },
    ],
  },
  {
    code: 'tent_bulk_bonus_2_plus_1',
    name: 'Tent Bulk Bonus (Rent 2 + 1 Free)',
    description:
      'Single-item promo package for open tents where all delivered units are included in stock checks.',
    items: [
      { itemTypeName: 'Open tent', requiredQty: 3, suggestedUnitPrice: 6666.67 },
    ],
  },
  {
    code: 'lights_bulk_bonus_8_plus_2',
    name: 'PAR Lights Bulk Bonus (Rent 8 + 2 Free)',
    description:
      'Single-item promo package for PAR lights with bonus units reflected directly in required quantity.',
    items: [
      { itemTypeName: 'PAR lights', requiredQty: 10, suggestedUnitPrice: 480 },
    ],
  },
  {
    code: 'speakers_bulk_bonus_4_plus_1',
    name: 'PA Speakers Bulk Bonus (Rent 4 + 1 Free)',
    description:
      'Single-item promo package for PA speakers suitable for medium programs and barangay events.',
    items: [
      { itemTypeName: 'PA speakers', requiredQty: 5, suggestedUnitPrice: 2080 },
    ],
  },
  {
    code: 'backdrop_bulk_bonus_2_plus_1',
    name: 'Backdrop Frames Bonus (Rent 2 + 1 Free)',
    description:
      'Single-item promo package for backdrop frames used in birthdays, debuts, and weddings.',
    items: [
      { itemTypeName: 'Backdrop frames', requiredQty: 3, suggestedUnitPrice: 3000 },
    ],
  },
  {
    code: 'wedding_standard_150pax',
    name: 'Wedding Standard (150 pax)',
    description:
      'Typical provincial wedding reception package with core seating, tables, tenting, and program setup.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 150, suggestedUnitPrice: 30 },
      { itemTypeName: 'Round banquet tables', requiredQty: 19, suggestedUnitPrice: 420 },
      { itemTypeName: 'Open tent', requiredQty: 2, suggestedUnitPrice: 9500 },
      { itemTypeName: 'Backdrop frames', requiredQty: 1, suggestedUnitPrice: 5200 },
      { itemTypeName: 'PA speakers', requiredQty: 2, suggestedUnitPrice: 2600 },
      { itemTypeName: 'Audio mixers', requiredQty: 1, suggestedUnitPrice: 1900 },
      { itemTypeName: 'PAR lights', requiredQty: 6, suggestedUnitPrice: 600 },
    ],
  },
  {
    code: 'birthday_basic_70pax',
    name: 'Birthday Basic (70 pax)',
    description:
      'Entry-level birthday setup suited for family gatherings and backyard events.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 70, suggestedUnitPrice: 28 },
      { itemTypeName: 'Rectangular banquet tables', requiredQty: 9, suggestedUnitPrice: 320 },
      { itemTypeName: 'Open tent', requiredQty: 1, suggestedUnitPrice: 7800 },
      { itemTypeName: 'PA speakers', requiredQty: 2, suggestedUnitPrice: 2400 },
      { itemTypeName: 'PAR lights', requiredQty: 4, suggestedUnitPrice: 550 },
      { itemTypeName: 'Backdrop frames', requiredQty: 1, suggestedUnitPrice: 3500 },
    ],
  },
  {
    code: 'debut_program_plus_120pax',
    name: 'Debut Program Plus (120 pax)',
    description:
      'Common 18th birthday setup with runway/program support, sound, and ambience lights.',
    items: [
      { itemTypeName: 'Folding chairs', requiredQty: 120, suggestedUnitPrice: 45 },
      { itemTypeName: 'Round banquet tables', requiredQty: 15, suggestedUnitPrice: 420 },
      { itemTypeName: 'Modular stage platforms', requiredQty: 10, suggestedUnitPrice: 1350 },
      { itemTypeName: 'PA speakers', requiredQty: 4, suggestedUnitPrice: 2900 },
      { itemTypeName: 'Audio mixers', requiredQty: 1, suggestedUnitPrice: 2200 },
      { itemTypeName: 'PAR lights', requiredQty: 10, suggestedUnitPrice: 620 },
      { itemTypeName: 'Backdrop frames', requiredQty: 2, suggestedUnitPrice: 4700 },
    ],
  },
  {
    code: 'corporate_seminar_av_100pax',
    name: 'Corporate Seminar AV (100 pax)',
    description:
      'Hotel or function hall seminar package focused on program audio-visual coverage.',
    items: [
      { itemTypeName: 'Folding chairs', requiredQty: 100, suggestedUnitPrice: 50 },
      { itemTypeName: 'Rectangular banquet tables', requiredQty: 10, suggestedUnitPrice: 380 },
      { itemTypeName: 'Modular stage platforms', requiredQty: 6, suggestedUnitPrice: 1400 },
      { itemTypeName: 'PA speakers', requiredQty: 4, suggestedUnitPrice: 3200 },
      { itemTypeName: 'Audio mixers', requiredQty: 1, suggestedUnitPrice: 2500 },
      { itemTypeName: 'LED wall panels', requiredQty: 6, suggestedUnitPrice: 3000 },
      { itemTypeName: 'Extension cords', requiredQty: 10, suggestedUnitPrice: 120 },
      { itemTypeName: 'Generators', requiredQty: 1, suggestedUnitPrice: 4500 },
    ],
  },
  {
    code: 'barangay_fiesta_value_200pax',
    name: 'Barangay Fiesta Value (200 pax)',
    description:
      'Cost-aware barangay event package for larger outdoor crowds with practical essentials.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 200, suggestedUnitPrice: 25 },
      { itemTypeName: 'Rectangular banquet tables', requiredQty: 25, suggestedUnitPrice: 300 },
      { itemTypeName: 'Open tent', requiredQty: 3, suggestedUnitPrice: 8500 },
      { itemTypeName: 'PA speakers', requiredQty: 2, suggestedUnitPrice: 2400 },
      { itemTypeName: 'Audio mixers', requiredQty: 1, suggestedUnitPrice: 1800 },
      { itemTypeName: 'Industrial fans', requiredQty: 6, suggestedUnitPrice: 700 },
      { itemTypeName: 'Extension cords', requiredQty: 12, suggestedUnitPrice: 100 },
    ],
  },
  {
    code: 'funeral_memorial_canopy_80pax',
    name: 'Funeral Memorial Canopy (80 pax)',
    description:
      'Respectful memorial setup with seating, shade, lighting, and essential sound support for wakes and services.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 80, suggestedUnitPrice: 26 },
      { itemTypeName: 'Rectangular banquet tables', requiredQty: 10, suggestedUnitPrice: 320 },
      { itemTypeName: 'Open tent', requiredQty: 2, suggestedUnitPrice: 8200 },
      { itemTypeName: 'PA speakers', requiredQty: 2, suggestedUnitPrice: 2300 },
      { itemTypeName: 'PAR lights', requiredQty: 4, suggestedUnitPrice: 500 },
      { itemTypeName: 'Industrial fans', requiredQty: 4, suggestedUnitPrice: 650 },
    ],
  },
  {
    code: 'baptism_reception_family_50pax',
    name: 'Baptism Reception Family (50 pax)',
    description:
      'Compact church-to-reception package with kid-friendly seating and simple decor accents.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 50, suggestedUnitPrice: 28 },
      { itemTypeName: 'Rectangular banquet tables', requiredQty: 6, suggestedUnitPrice: 300 },
      { itemTypeName: 'Open tent', requiredQty: 1, suggestedUnitPrice: 7600 },
      { itemTypeName: 'Backdrop frames', requiredQty: 1, suggestedUnitPrice: 3200 },
      { itemTypeName: 'Balloon arches', requiredQty: 1, suggestedUnitPrice: 2200 },
      { itemTypeName: 'PAR lights', requiredQty: 4, suggestedUnitPrice: 520 },
    ],
  },
  {
    code: 'graduation_program_night_120pax',
    name: 'Graduation Program Night (120 pax)',
    description:
      'Stage-focused school graduation package with ceremony setup, AV support, and lighting coverage.',
    items: [
      { itemTypeName: 'Folding chairs', requiredQty: 120, suggestedUnitPrice: 42 },
      { itemTypeName: 'Rectangular banquet tables', requiredQty: 12, suggestedUnitPrice: 360 },
      { itemTypeName: 'Modular stage platforms', requiredQty: 8, suggestedUnitPrice: 1400 },
      { itemTypeName: 'PA speakers', requiredQty: 4, suggestedUnitPrice: 2800 },
      { itemTypeName: 'Audio mixers', requiredQty: 1, suggestedUnitPrice: 2100 },
      { itemTypeName: 'PAR lights', requiredQty: 10, suggestedUnitPrice: 600 },
      { itemTypeName: 'LED wall panels', requiredQty: 4, suggestedUnitPrice: 2800 },
    ],
  },
  {
    code: 'reunion_garden_chill_90pax',
    name: 'Reunion Garden Chill (90 pax)',
    description:
      'Relaxed family reunion setup for afternoon-to-evening events with comfort and ambience basics.',
    items: [
      { itemTypeName: 'Monoblock chairs', requiredQty: 90, suggestedUnitPrice: 27 },
      { itemTypeName: 'Round banquet tables', requiredQty: 11, suggestedUnitPrice: 390 },
      { itemTypeName: 'Open tent', requiredQty: 2, suggestedUnitPrice: 8600 },
      { itemTypeName: 'String lights', requiredQty: 8, suggestedUnitPrice: 340 },
      { itemTypeName: 'Industrial fans', requiredQty: 4, suggestedUnitPrice: 700 },
      { itemTypeName: 'Coffee tables', requiredQty: 4, suggestedUnitPrice: 250 },
    ],
  },
];

export interface PackageEligibilitySeedResult {
  adminPackagesCreated: number;
  adminPackagesUpdated: number;
  adminPackageItemsWritten: number;
  vendorPackagesCreated: number;
  vendorPackagesUpdated: number;
  vendorPackageItemsWritten: number;
  eligibleCount: number;
  availableCount: number;
  partiallyAvailableCount: number;
  disabledCount: number;
  vendorsProcessed: number;
  seedAvailabilityDate: string;
}

@Injectable()
export class PackageEligibilitySeedService {
  constructor(
    @InjectRepository(AdminPackageTemplate)
    private readonly adminPackageRepo: Repository<AdminPackageTemplate>,
    @InjectRepository(AdminPackageTemplateItem)
    private readonly adminPackageItemRepo: Repository<AdminPackageTemplateItem>,
    @InjectRepository(VendorPackage)
    private readonly vendorPackageRepo: Repository<VendorPackage>,
    @InjectRepository(VendorPackageItem)
    private readonly vendorPackageItemRepo: Repository<VendorPackageItem>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(ItemType)
    private readonly itemTypeRepo: Repository<ItemType>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async seed(): Promise<PackageEligibilitySeedResult> {
    const itemTypes = await this.itemTypeRepo.find({ where: { isActive: true } });
    const itemTypeByName = new Map(itemTypes.map((itemType) => [itemType.name.toLowerCase(), itemType]));

    let adminPackagesCreated = 0;
    let adminPackagesUpdated = 0;
    let adminPackageItemsWritten = 0;
    let vendorPackagesCreated = 0;
    let vendorPackagesUpdated = 0;
    let vendorPackageItemsWritten = 0;

    const resolvedAdminPackages: Array<{
      template: AdminPackageTemplate;
      items: Array<{ itemType: ItemType; requiredQty: number; suggestedUnitPrice?: number }>;
    }> = [];

    for (const definition of ADMIN_PACKAGE_SEED_DEFINITIONS) {
      let template = await this.adminPackageRepo.findOne({ where: { code: definition.code } });
      if (!template) {
        template = this.adminPackageRepo.create({
          code: definition.code,
          name: definition.name,
          description: definition.description,
          isActive: true,
        });
        template = await this.adminPackageRepo.save(template);
        adminPackagesCreated += 1;
      } else {
        template.name = definition.name;
        template.description = definition.description;
        template.isActive = true;
        template = await this.adminPackageRepo.save(template);
        adminPackagesUpdated += 1;
      }

      const resolvedItems: Array<{ itemType: ItemType; requiredQty: number; suggestedUnitPrice?: number }> = [];
      for (const seededItem of definition.items) {
        const itemType = itemTypeByName.get(seededItem.itemTypeName.toLowerCase());
        if (!itemType) continue;

        let templateItem = await this.adminPackageItemRepo.findOne({
          where: {
            packageId: template.id,
            itemTypeId: itemType.id,
          },
        });

        if (!templateItem) {
          templateItem = this.adminPackageItemRepo.create({
            packageId: template.id,
            itemTypeId: itemType.id,
            requiredQty: seededItem.requiredQty,
            suggestedUnitPrice:
              seededItem.suggestedUnitPrice == null
                ? null
                : Number(seededItem.suggestedUnitPrice),
          });
        } else {
          templateItem.requiredQty = seededItem.requiredQty;
          templateItem.suggestedUnitPrice =
            seededItem.suggestedUnitPrice == null
              ? null
              : Number(seededItem.suggestedUnitPrice);
        }

        await this.adminPackageItemRepo.save(templateItem);
        adminPackageItemsWritten += 1;

        resolvedItems.push({
          itemType,
          requiredQty: seededItem.requiredQty,
          suggestedUnitPrice: seededItem.suggestedUnitPrice,
        });
      }

      resolvedAdminPackages.push({ template, items: resolvedItems });
    }

    const vendors = await this.vendorRepo.find({ where: { isActive: true, isVerified: true } });
    const vendorIds = vendors.map((vendor) => vendor.id);

    const inventories = vendorIds.length
      ? await this.inventoryRepo.find({ where: { vendorId: In(vendorIds) } })
      : [];

    const inventoryByVendorItemType = new Map<string, Map<string, number>>();
    for (const inventory of inventories) {
      const vendorInventory =
        inventoryByVendorItemType.get(inventory.vendorId) || new Map<string, number>();
      vendorInventory.set(inventory.itemTypeId, Number(inventory.quantity || 0));
      inventoryByVendorItemType.set(inventory.vendorId, vendorInventory);
    }

    const availabilityDate = addDays(new Date(), 14);
    const availabilityDateIso = format(availabilityDate, 'yyyy-MM-dd');
    const overlappingBookings = vendorIds.length
      ? await this.bookingRepo
          .createQueryBuilder('booking')
          .leftJoinAndSelect('booking.items', 'item')
          .leftJoinAndSelect('item.inventoryItem', 'inventoryItem')
          .where('booking.vendorId IN (:...vendorIds)', { vendorIds })
          .andWhere('booking.status IN (:...statuses)', {
            statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          })
          .andWhere('booking.startDate <= :seedDate', { seedDate: availabilityDateIso })
          .andWhere('booking.endDate >= :seedDate', { seedDate: availabilityDateIso })
          .getMany()
      : [];

    const reservedByVendorItemType = new Map<string, Map<string, number>>();
    for (const booking of overlappingBookings) {
      const vendorReservedMap =
        reservedByVendorItemType.get(booking.vendorId) || new Map<string, number>();
      for (const bookingItem of booking.items || []) {
        const itemTypeId = bookingItem.inventoryItem?.itemTypeId;
        if (!itemTypeId) continue;
        const qty = Number(bookingItem.quantity || 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const current = vendorReservedMap.get(itemTypeId) || 0;
        vendorReservedMap.set(itemTypeId, current + qty);
      }
      reservedByVendorItemType.set(booking.vendorId, vendorReservedMap);
    }

    let eligibleCount = 0;
    let availableCount = 0;
    let partiallyAvailableCount = 0;
    let disabledCount = 0;

    for (const vendor of vendors) {
      const inventoryMap = inventoryByVendorItemType.get(vendor.id) || new Map<string, number>();
      const reservedMap = reservedByVendorItemType.get(vendor.id) || new Map<string, number>();

      for (let packageIndex = 0; packageIndex < resolvedAdminPackages.length; packageIndex += 1) {
        const resolvedPackage = resolvedAdminPackages[packageIndex];
        const isDateCheckedPackage = packageIndex === 0;

        let vendorPackage = await this.vendorPackageRepo.findOne({
          where: {
            vendorId: vendor.id,
            basePackageId: resolvedPackage.template.id,
          },
        });

        const draftItems = resolvedPackage.items.map((seeded) => {
          const stockQty = Number(inventoryMap.get(seeded.itemType.id) || 0);
          if (stockQty > 0 && stockQty < seeded.requiredQty && seeded.itemType.name === 'Monoblock chairs') {
            return {
              ...seeded,
              requiredQty: stockQty,
              source: VendorPackageItemSource.OVERRIDE,
              overridden: true,
            };
          }

          return {
            ...seeded,
            requiredQty: seeded.requiredQty,
            source: VendorPackageItemSource.BASE,
            overridden: false,
          };
        });

        const hasOverride = draftItems.some((item) => item.overridden);

        const hasInventoryGap = draftItems.some(
          (item) => Number(inventoryMap.get(item.itemType.id) || 0) < item.requiredQty,
        );

        const hasAvailabilityGap = draftItems.some((item) => {
          const total = Number(inventoryMap.get(item.itemType.id) || 0);
          const reserved = Number(reservedMap.get(item.itemType.id) || 0);
          const available = Math.max(total - reserved, 0);
          return available < item.requiredQty;
        });

        let status: VendorPackageStatus;
        if (hasInventoryGap) {
          status = VendorPackageStatus.DISABLED;
          disabledCount += 1;
        } else if (!isDateCheckedPackage) {
          status = VendorPackageStatus.ELIGIBLE;
          eligibleCount += 1;
        } else if (hasAvailabilityGap) {
          status = VendorPackageStatus.PARTIALLY_AVAILABLE;
          partiallyAvailableCount += 1;
        } else {
          status = VendorPackageStatus.AVAILABLE;
          availableCount += 1;
        }

        if (!vendorPackage) {
          vendorPackage = this.vendorPackageRepo.create({
            vendorId: vendor.id,
            basePackageId: resolvedPackage.template.id,
            source: VendorPackageSource.ADMIN,
            packageName: hasOverride
              ? `${vendor.businessName} ${resolvedPackage.template.name}`
              : resolvedPackage.template.name,
            hasOverride,
            status,
            statusDate: isDateCheckedPackage ? availabilityDate : null,
            overrideMetadata: hasOverride
              ? JSON.stringify({
                  reason: 'auto-adjusted-by-seed',
                  notes:
                    'Required quantities were reduced to the vendor inventory ceiling for selected items.',
                })
              : null,
            isActive: true,
          });
          vendorPackage = await this.vendorPackageRepo.save(vendorPackage);
          vendorPackagesCreated += 1;
        } else {
          vendorPackage.packageName = hasOverride
            ? `${vendor.businessName} ${resolvedPackage.template.name}`
            : resolvedPackage.template.name;
          vendorPackage.hasOverride = hasOverride;
          vendorPackage.status = status;
          vendorPackage.statusDate = isDateCheckedPackage ? availabilityDate : null;
          vendorPackage.overrideMetadata = hasOverride
            ? JSON.stringify({
                reason: 'auto-adjusted-by-seed',
                notes:
                  'Required quantities were reduced to the vendor inventory ceiling for selected items.',
              })
            : null;
          vendorPackage.isActive = true;
          vendorPackage = await this.vendorPackageRepo.save(vendorPackage);
          vendorPackagesUpdated += 1;
        }

        for (const draftItem of draftItems) {
          let vendorPackageItem = await this.vendorPackageItemRepo.findOne({
            where: {
              vendorPackageId: vendorPackage.id,
              itemTypeId: draftItem.itemType.id,
            },
          });

          if (!vendorPackageItem) {
            vendorPackageItem = this.vendorPackageItemRepo.create({
              vendorPackageId: vendorPackage.id,
              itemTypeId: draftItem.itemType.id,
              requiredQty: draftItem.requiredQty,
              unitPrice:
                draftItem.suggestedUnitPrice == null
                  ? null
                  : Number(draftItem.suggestedUnitPrice),
              source: draftItem.source,
            });
          } else {
            vendorPackageItem.requiredQty = draftItem.requiredQty;
            vendorPackageItem.unitPrice =
              draftItem.suggestedUnitPrice == null
                ? null
                : Number(draftItem.suggestedUnitPrice);
            vendorPackageItem.source = draftItem.source;
          }

          await this.vendorPackageItemRepo.save(vendorPackageItem);
          vendorPackageItemsWritten += 1;
        }
      }
    }

    return {
      adminPackagesCreated,
      adminPackagesUpdated,
      adminPackageItemsWritten,
      vendorPackagesCreated,
      vendorPackagesUpdated,
      vendorPackageItemsWritten,
      eligibleCount,
      availableCount,
      partiallyAvailableCount,
      disabledCount,
      vendorsProcessed: vendors.length,
      seedAvailabilityDate: availabilityDateIso,
    };
  }
}