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

  async findAll(
    includeInactive = false,
    filters?: { eventTag?: string; setTag?: string },
  ) {
    const rows = includeInactive
      ? await this.repo.find({ order: { name: 'ASC' } })
      : await this.repo.find({
        where: { isActive: true },
        order: { name: 'ASC' },
      });

    const normalizedEventTag = String(filters?.eventTag || '').trim().toLowerCase();
    const normalizedSetTag = String(filters?.setTag || '').trim().toLowerCase();

    if (!normalizedEventTag && !normalizedSetTag) {
      return rows;
    }

    return rows.filter((itemType) => {
      const eventTags = this.normalizeTags(itemType.eventTags);
      const setTags = this.normalizeTags(itemType.setTags);

      const eventTagMatches =
        !normalizedEventTag ||
        !eventTags.length ||
        eventTags.includes(normalizedEventTag);
      const setTagMatches =
        !normalizedSetTag ||
        !setTags.length ||
        setTags.includes(normalizedSetTag);

      return eventTagMatches && setTagMatches;
    });
  }

  async findSetTags(includeInactive = false) {
    const rows = includeInactive
      ? await this.repo.find({ order: { name: 'ASC' } })
      : await this.repo.find({
        where: { isActive: true },
        order: { name: 'ASC' },
      });

    return Array.from(
      new Set(
        rows
          .flatMap((itemType) => this.normalizeTags(itemType.setTags))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }

  findById(id: string) { return this.repo.findOne({ where: { id } }); }
  async create(data: Partial<ItemType>) { return this.repo.save(this.repo.create(data)); }
  async update(id: string, data: Partial<ItemType>) { await this.repo.update(id, data); return this.findById(id); }
  async remove(id: string) { await this.repo.delete(id); }

  private normalizeTags(tags?: string[] | null): string[] {
    if (!Array.isArray(tags)) return [];
    return tags
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean);
  }
}
