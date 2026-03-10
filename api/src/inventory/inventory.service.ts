import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';

@Injectable()
export class InventoryService {
  constructor(@InjectRepository(InventoryItem) private readonly repo: Repository<InventoryItem>) {}

  findByVendor(vendorId: string) {
    return this.repo.find({ where: { vendorId }, relations: ['itemType', 'brand'] });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['itemType', 'brand'] });
  }

  async create(data: Partial<InventoryItem>) {
    const item = this.repo.create(data);
    if (item.availableQuantity === undefined) item.availableQuantity = item.quantity;
    return this.repo.save(item);
  }

  async update(id: string, data: Partial<InventoryItem>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string) {
    await this.repo.delete(id);
  }
}
