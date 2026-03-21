import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { Vendor, VendorVerificationStatus } from '../vendors/entities/vendor.entity';
import { VendorItem } from '../vendors/entities/vendor-item.entity';
import { SettingsService } from '../settings/settings.service';


@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly repo: Repository<InventoryItem>,
    @InjectRepository(ItemType)
    private readonly itemTypesRepo: Repository<ItemType>,
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(BookingItem)
    private readonly bookingItemsRepo: Repository<BookingItem>,
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Returns inventory breakdown for a vendor: total, reserved (confirmed), and available per item for a given date (default: today)
   */
  async getVendorInventoryBreakdown(vendorId: string, date?: string) {
    // Parse date or use today
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Get all confirmed bookings for this vendor that overlap with the target date
    const bookings = await this.bookingsRepo.find({
      where: { vendorId },
      relations: ['items'],
    });
    const confirmedBookings = bookings.filter(b =>
      b.status === BookingStatus.CONFIRMED &&
      new Date(b.endDate) >= targetDate &&
      new Date(b.startDate) <= targetDate
    );

    // Get all inventory items for this vendor
    const inventory = await this.repo.find({ where: { vendorId }, relations: ['itemType', 'brand'] });

    // For each item, sum reserved (confirmed booked) and calculate available
    const breakdown = inventory.map(item => {
      const reserved = confirmedBookings.reduce((sum, booking) => {
        const bookingItem = booking.items?.find(bi => bi.inventoryItemId === item.id);
        return sum + (bookingItem?.quantity || 0);
      }, 0);
      const total = Number(item.quantity);
      const available = Math.max(0, total - reserved);
      return {
        id: item.id,
        itemType: item.itemType,
        color: item.color,
        brand: item.brand,
        total,
        reserved,
        available,
        ratePerDay: item.ratePerDay,
        pictureUrl: item.pictureUrl,
      };
    });
    return breakdown;
  }

  async findByVendor(vendorId: string) {
    const items = await this.repo.find({ where: { vendorId }, relations: ['itemType', 'brand'] });
    const itemsWithGalleryPhotos = await this.attachGalleryPhotos(items);
    
    // Return items with availableQuantity = total quantity
    // Date-aware availability is checked during booking
    return itemsWithGalleryPhotos.map(item => ({
      ...item,
      availableQuantity: Number(item.quantity),
    }));
  }

  async findById(id: string) {
    const item = await this.repo.findOne({ where: { id }, relations: ['itemType', 'brand'] });
    if (!item) return null;

    const [itemWithGalleryPhotos] = await this.attachGalleryPhotos([item]);
    return itemWithGalleryPhotos || item;
  }

  async create(data: Partial<InventoryItem>) {
    if (!data.vendorId) {
      throw new BadRequestException('vendorId is required');
    }

    await this.assertVendorCanCreateListing(data.vendorId);

    if (!data.itemTypeId) {
      throw new BadRequestException('itemTypeId is required');
    }

    const itemType = await this.itemTypesRepo.findOne({ where: { id: data.itemTypeId } });
    if (!itemType) {
      throw new NotFoundException('Item type not found');
    }
    if (!itemType.isActive) {
      throw new BadRequestException('Item type is disabled by admin');
    }

    // Handle brandId: set to null if missing/empty, validate if provided
    let brandId = data.brandId;
    if (!brandId || brandId === '' || brandId === undefined) {
      brandId = null;
    } else {
      // Validate brand exists
      const brandRepo = this.repo.manager.getRepository('ProductBrand');
      const brand = await brandRepo.findOne({ where: { id: brandId } });
      if (!brand) {
        throw new BadRequestException('Brand not found');
      }
    }

    const item = this.repo.create({
      ...data,
      brandId,
      color: this.normalizeOptionalText(data.color),
    });

    if (item.ratePerDay === undefined || item.ratePerDay === null || Number.isNaN(Number(item.ratePerDay))) {
      item.ratePerDay = Number(itemType.defaultRatePerDay) || 0;
    }
    if (item.availableQuantity === undefined) item.availableQuantity = item.quantity;

    return this.repo.save(item);
  }

  async update(id: string, data: Partial<InventoryItem>) {
    const existing = await this.repo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Inventory item not found');
    }

    const nextQuantity = data.quantity !== undefined
      ? Number(data.quantity)
      : Number(existing.quantity);

    const reservedQuantity = Math.max(
      Number(existing.quantity) - Number(existing.availableQuantity),
      0,
    );

    const derivedAvailable = data.availableQuantity !== undefined
      ? Number(data.availableQuantity)
      : data.quantity !== undefined
        ? Math.max(nextQuantity - reservedQuantity, 0)
        : Number(existing.availableQuantity);

    const nextAvailable = Math.min(nextQuantity, Math.max(0, derivedAvailable));

    const updated = this.repo.merge(existing, {
      ...data,
      color: data.color !== undefined
        ? this.normalizeOptionalText(data.color)
        : existing.color,
      quantity: nextQuantity,
      availableQuantity: nextAvailable,
      ratePerDay: data.ratePerDay !== undefined ? Number(data.ratePerDay) : existing.ratePerDay,
    });

    return this.repo.save(updated);
  }

  async remove(id: string) {
    await this.repo.delete(id);
  }

  private normalizeOptionalText(input: unknown): string | null {
    const value = String(input ?? '').trim();
    return value || null;
  }

  private async attachGalleryPhotos<T extends InventoryItem>(items: T[]) {
    if (!items.length) return [] as Array<T & { galleryPhotos: string[] }>;

    const inventoryItemIds = items.map((item) => item.id).filter(Boolean);
    if (!inventoryItemIds.length) {
      return items.map((item) => ({ ...item, galleryPhotos: [] }));
    }

    const vendorItems = await this.dataSource.getRepository(VendorItem).find({
      where: { inventoryItemId: In(inventoryItemIds) },
      relations: ['photos'],
    });

    const galleryPhotosByInventoryId = new Map<string, string[]>();

    for (const vendorItem of vendorItems) {
      if (!vendorItem.inventoryItemId) continue;

      const existingGalleryPhotos =
        galleryPhotosByInventoryId.get(vendorItem.inventoryItemId) || [];

      const galleryPhotos = (vendorItem.photos || [])
        .slice()
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        )
        .filter((photo) => this.isGalleryVendorPhotoMetadata(photo.metadata))
        .map((photo) => String(photo.fileUrl || '').trim())
        .filter((photoUrl): photoUrl is string => Boolean(photoUrl));

      if (!galleryPhotos.length) continue;

      const mergedGalleryPhotos = [...existingGalleryPhotos];
      for (const galleryPhoto of galleryPhotos) {
        if (!mergedGalleryPhotos.includes(galleryPhoto)) {
          mergedGalleryPhotos.push(galleryPhoto);
        }
      }

      galleryPhotosByInventoryId.set(
        vendorItem.inventoryItemId,
        mergedGalleryPhotos,
      );
    }

    return items.map((item) => {
      const galleryPhotos = galleryPhotosByInventoryId.get(item.id) || [];
      return {
        ...item,
        pictureUrl: item.pictureUrl || galleryPhotos[0] || null,
        galleryPhotos,
      };
    });
  }

  private isGalleryVendorPhotoMetadata(metadataRaw?: string | null) {
    if (!metadataRaw) return false;

    try {
      const metadata = JSON.parse(metadataRaw);
      return String(metadata?.category || '').trim().toLowerCase() === 'gallery';
    } catch {
      return false;
    }
  }

  private async assertVendorCanCreateListing(vendorId: string) {
    const vendor = await this.vendorsRepo.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (!vendor.isActive || vendor.verificationStatus === VendorVerificationStatus.SUSPENDED) {
      throw new BadRequestException(
        'Your vendor account is restricted from creating new listings. Please contact support.',
      );
    }

    const currentListings = await this.repo.count({ where: { vendorId } });

    let completedOrdersThreshold = 5;
    let newVendorMaxActiveListings = 40;
    let flaggedVendorMaxActiveListings = 15;
    try {
      const flags = await this.settingsService.getFeatureFlagsSettings();
      completedOrdersThreshold = Number(flags.newVendorCompletedOrdersThreshold);
      newVendorMaxActiveListings = Number(flags.newVendorMaxActiveListings);
      flaggedVendorMaxActiveListings = Number(flags.flaggedVendorMaxActiveListings);
    } catch {
      // Fall back to safe defaults.
    }

    const isFlagged = Boolean(vendor.isSuspicious || vendor.lowRatingFlag);
    const maxListings = isFlagged
      ? flaggedVendorMaxActiveListings
      : Number(vendor.successfulCompletedOrders || 0) < completedOrdersThreshold
        ? newVendorMaxActiveListings
        : Number.MAX_SAFE_INTEGER;

    if (currentListings >= maxListings) {
      const reason = isFlagged
        ? 'your account is currently flagged for additional review'
        : 'your account is still in the new-vendor monitoring stage';

      throw new BadRequestException(
        `Listing limit reached (${maxListings} items) because ${reason}. Please contact admin for manual review.`,
      );
    }
  }
}
