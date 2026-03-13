import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';


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
    private readonly dataSource: DataSource,
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
    
    // Return items with availableQuantity = total quantity
    // Date-aware availability is checked during booking
    return items.map(item => ({
      ...item,
      availableQuantity: Number(item.quantity),
    }));
  }

  async findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['itemType', 'brand'] });
  }

  async create(data: Partial<InventoryItem>) {
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
}
