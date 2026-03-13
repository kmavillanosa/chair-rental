import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { ItemType } from '../item-types/entities/item-type.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly repo: Repository<InventoryItem>,
    @InjectRepository(ItemType)
    private readonly itemTypesRepo: Repository<ItemType>,
  ) {}

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

    const item = this.repo.create({
      ...data,
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
