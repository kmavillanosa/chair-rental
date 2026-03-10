import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductBrand } from './entities/product-brand.entity';

@Injectable()
export class BrandsService {
  constructor(@InjectRepository(ProductBrand) private readonly repo: Repository<ProductBrand>) {}
  findAll() { return this.repo.find({ relations: ['itemType'] }); }
  findByItemType(itemTypeId: string) { return this.repo.find({ where: { itemTypeId }, relations: ['itemType'] }); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  async create(data: Partial<ProductBrand>) { return this.repo.save(this.repo.create(data)); }
  async update(id: string, data: Partial<ProductBrand>) { await this.repo.update(id, data); return this.findById(id); }
  async remove(id: string) { await this.repo.delete(id); }
}
