import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemType } from './entities/item-type.entity';

@Injectable()
export class ItemTypesService {
  constructor(
    @InjectRepository(ItemType)
    private readonly repo: Repository<ItemType>,
  ) {}

  findAll() { return this.repo.find(); }
  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  async create(data: Partial<ItemType>) { return this.repo.save(this.repo.create(data)); }
  async update(id: string, data: Partial<ItemType>) { await this.repo.update(id, data); return this.findById(id); }
  async remove(id: string) { await this.repo.delete(id); }
}
