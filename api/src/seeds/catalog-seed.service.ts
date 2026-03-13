import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { extname, join, posix } from 'path';
import { ItemType } from '../item-types/entities/item-type.entity';
import { ProductBrand } from '../brands/entities/product-brand.entity';
import { CATALOG_SEED_DATA } from './catalog.seed-data';

export interface CatalogSeedResult {
  itemTypesCreated: number;
  brandsCreated: number;
  itemTypesWithSeededPictures: number;
  itemTypesMissingSeededPictures: number;
  itemTypesTotal: number;
  brandsTotal: number;
}

@Injectable()
export class CatalogSeedService {
  private static readonly IMAGE_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.avif',
    '.gif',
  ]);

  private static readonly FOLDER_SUFFIX_WORDS = [
    'chairs',
    'chair',
    'tables',
    'table',
    'tents',
    'tent',
    'sofas',
    'sofa',
    'stools',
    'stool',
    'frames',
    'frame',
    'mixers',
    'mixer',
    'coolers',
    'cooler',
    'equipment',
    'lights',
    'light',
    'flowers',
    'flower',
  ];

  private readonly uploadRootDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(ItemType)
    private readonly itemTypesRepo: Repository<ItemType>,
    @InjectRepository(ProductBrand)
    private readonly brandsRepo: Repository<ProductBrand>,
  ) {}

  async seed(): Promise<CatalogSeedResult> {
    let itemTypesCreated = 0;
    let brandsCreated = 0;
    let itemTypesWithSeededPictures = 0;
    let itemTypesMissingSeededPictures = 0;

    const existingTypes = await this.itemTypesRepo.find();
    const itemTypeByName = new Map<string, ItemType>();

    for (const existingType of existingTypes) {
      itemTypeByName.set(existingType.name.trim().toLowerCase(), existingType);
    }

    for (const category of CATALOG_SEED_DATA) {
      for (const typeName of category.types) {
        const normalizedTypeName = typeName.trim().toLowerCase();
        const normalizedEventTags = this.normalizeTags(category.eventTags);
        const normalizedSetTags = this.normalizeTags(category.setTags);
        const seededPictureUrl = this.resolveSeedPictureUrl(typeName);
        const existingType = itemTypeByName.get(normalizedTypeName);

        if (existingType) {
          const currentEventTags = this.normalizeTags(existingType.eventTags);
          const currentSetTags = this.normalizeTags(existingType.setTags);
          const shouldSyncPicture = Boolean(seededPictureUrl)
            && existingType.pictureUrl !== seededPictureUrl;

          if (
            !this.sameTags(currentEventTags, normalizedEventTags)
            || !this.sameTags(currentSetTags, normalizedSetTags)
            || shouldSyncPicture
          ) {
            existingType.eventTags = normalizedEventTags;
            existingType.setTags = normalizedSetTags;
            if (seededPictureUrl) {
              existingType.pictureUrl = seededPictureUrl;
            }
            await this.itemTypesRepo.save(existingType);
          }

          if (seededPictureUrl || existingType.pictureUrl) {
            itemTypesWithSeededPictures += 1;
          } else {
            itemTypesMissingSeededPictures += 1;
          }

          continue;
        }

        const createdType = await this.itemTypesRepo.save(
          this.itemTypesRepo.create({
            name: typeName,
            description: `Category: ${category.category}`,
            defaultRatePerDay: 0,
            eventTags: normalizedEventTags,
            setTags: normalizedSetTags,
            pictureUrl: seededPictureUrl,
          }),
        );

        if (seededPictureUrl) {
          itemTypesWithSeededPictures += 1;
        } else {
          itemTypesMissingSeededPictures += 1;
        }

        itemTypesCreated += 1;
        itemTypeByName.set(normalizedTypeName, createdType);
      }
    }

    const existingBrands = await this.brandsRepo.find();
    const brandKeySet = new Set<string>();

    for (const existingBrand of existingBrands) {
      brandKeySet.add(this.toBrandKey(existingBrand.itemTypeId, existingBrand.name));
    }

    for (const category of CATALOG_SEED_DATA) {
      for (const typeName of category.types) {
        const itemType = itemTypeByName.get(typeName.trim().toLowerCase());
        if (!itemType) continue;

        for (const brandName of category.brands) {
          const brandKey = this.toBrandKey(itemType.id, brandName);
          if (brandKeySet.has(brandKey)) continue;

          await this.brandsRepo.save(
            this.brandsRepo.create({
              itemTypeId: itemType.id,
              name: brandName,
              description: `Seeded brand for ${category.category}`,
            }),
          );

          brandsCreated += 1;
          brandKeySet.add(brandKey);
        }
      }
    }

    return {
      itemTypesCreated,
      brandsCreated,
      itemTypesWithSeededPictures,
      itemTypesMissingSeededPictures,
      itemTypesTotal: await this.itemTypesRepo.count(),
      brandsTotal: await this.brandsRepo.count(),
    };
  }

  private resolveSeedPictureUrl(typeName: string): string | undefined {
    if (!fs.existsSync(this.uploadRootDir)) return undefined;

    const folderName = this.resolveTypeImageFolder(typeName);
    if (!folderName) return undefined;

    const folderPath = join(this.uploadRootDir, folderName);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return undefined;
    }

    const imageFileName = this.pickImageFileName(folderPath);
    if (!imageFileName) return undefined;

    return posix.join('/uploads', folderName, imageFileName);
  }

  private resolveTypeImageFolder(typeName: string): string | undefined {
    const entries = fs.readdirSync(this.uploadRootDir, { withFileTypes: true });
    const folderNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    if (folderNames.length === 0) return undefined;

    const normalizedFolderMap = new Map<string, string>();
    for (const folderName of folderNames) {
      normalizedFolderMap.set(this.normalizeForPath(folderName), folderName);
    }

    const folderCandidates = this.getTypeFolderCandidates(typeName);

    for (const candidate of folderCandidates) {
      const exactMatch = normalizedFolderMap.get(candidate);
      if (exactMatch) return exactMatch;
    }

    const fullSlug = this.normalizeForPath(typeName);
    for (const [normalizedFolderName, rawFolderName] of normalizedFolderMap) {
      if (
        fullSlug.startsWith(`${normalizedFolderName}-`)
        || normalizedFolderName.startsWith(`${fullSlug}-`)
      ) {
        return rawFolderName;
      }
    }

    return undefined;
  }

  private getTypeFolderCandidates(typeName: string): string[] {
    const fullSlug = this.normalizeForPath(typeName);
    const candidates = new Set<string>([fullSlug]);

    let trimmedSlug = fullSlug;
    for (const suffixWord of CatalogSeedService.FOLDER_SUFFIX_WORDS) {
      const suffix = `-${suffixWord}`;
      if (trimmedSlug.endsWith(suffix)) {
        trimmedSlug = trimmedSlug.slice(0, -suffix.length);
        if (trimmedSlug) {
          candidates.add(trimmedSlug);
        }
      }
    }

    return Array.from(candidates);
  }

  private pickImageFileName(folderPath: string): string | undefined {
    const fileNames = fs.readdirSync(folderPath)
      .filter((fileName) => {
        const extension = extname(fileName).toLowerCase();
        return CatalogSeedService.IMAGE_EXTENSIONS.has(extension);
      })
      .sort((left, right) => left.localeCompare(right));

    return fileNames[0];
  }

  private normalizeForPath(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toBrandKey(itemTypeId: string, brandName: string) {
    return `${itemTypeId}|${brandName.trim().toLowerCase()}`;
  }

  private normalizeTags(tags?: string[] | null): string[] {
    if (!Array.isArray(tags)) return [];
    return Array.from(
      new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)),
    );
  }

  private sameTags(current: string[], next: string[]): boolean {
    if (current.length !== next.length) return false;
    return current.every((tag) => next.includes(tag));
  }
}