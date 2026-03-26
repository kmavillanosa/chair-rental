import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { extname, join, posix } from 'path';
import { ItemType } from '../item-types/entities/item-type.entity';
import { ProductBrand } from '../brands/entities/product-brand.entity';

export interface CatalogSeedResult {
  itemTypesCreated: number;
  itemTypesUpdated: number;
  itemTypesDeactivated: number;
  brandsCreated: number;
  itemTypesWithSeededPictures: number;
  itemTypesMissingSeededPictures: number;
  itemTypesTotal: number;
  brandsTotal: number;
}

type CatalogProfile = {
  eventTags: string[];
  setTags: string[];
  brands: string[];
  defaultRatePerDay: number;
  matchers: Array<string | RegExp>;
};

type CatalogTypeVariant = {
  name: string;
  defaultRatePerDay: number;
  variantLabel?: string;
};

type SizeVariantRule = {
  matchers: Array<string | RegExp>;
  includeBaseType?: boolean;
  variants: Array<{
    suffix: string;
    rate?: number;
    rateDelta?: number;
  }>;
};

const COMMON_EVENT_TAGS = [
  'birthday',
  'debut',
  'wedding',
  'funeral',
  'baptism',
  'anniversary',
  'corporate',
  'reunion',
  'graduation',
  'fiesta',
];

const TECH_EVENT_TAGS = [...COMMON_EVENT_TAGS, 'seminar', 'concert'];

const CATALOG_PROFILES: CatalogProfile[] = [
  {
    matchers: [
      'chair',
      'stool',
      'sofa',
      'ottoman',
      'monoblock',
      'chiavari',
      'ghost',
      'kids-chairs',
      'lounge-chairs',
      'picnic-chairs',
    ],
    defaultRatePerDay: 12,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['seating-set', 'table-set', 'reception-set', 'ceremony-set'],
    brands: [
      'Lifetime Products',
      'Mandaue Foam',
      'Uratex Monoblock',
      'Flash Furniture',
    ],
  },
  {
    matchers: ['table', 'buffet', 'coffee-table', 'kids-tables', 'picnic-tables'],
    defaultRatePerDay: 150,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['table-set', 'dining-set', 'buffet-set', 'reception-set'],
    brands: ['Lifetime Products', 'Iceberg Enterprises', 'COSCO', 'Correll'],
  },
  {
    matchers: ['tent', 'gazebo', 'pagoda', 'high-peak', 'retractable'],
    defaultRatePerDay: 3500,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['tent-set', 'outdoor-set', 'booth-set', 'shelter-set'],
    brands: ['Eurmax', 'ABCCanopy', 'Mastertent', 'ShelterLogic'],
  },
  {
    matchers: [
      'stage',
      'runway',
      'catwalk',
      'dance-floor',
      'pipe-and-drape',
      'backdrop',
      'podium',
    ],
    defaultRatePerDay: 1800,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['stage-set', 'program-set', 'performance-set'],
    brands: [
      'Staging Concepts',
      'Global Truss',
      'ProX Live Performance Gear',
      'Intellistage',
    ],
  },
  {
    matchers: [
      'speaker',
      'subwoofer',
      'amplifier',
      'audio-mixer',
      'microphone',
      'karaoke',
      'dj-controller',
      'monitor-speakers',
      'pa-speakers',
    ],
    defaultRatePerDay: 1400,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['sound-set', 'dj-set', 'karaoke-set', 'program-set'],
    brands: ['JBL', 'QSC', 'Yamaha', 'Shure', 'Sennheiser', 'Behringer'],
  },
  {
    matchers: [
      'par-lights',
      'led-wash',
      'moving-head',
      'follow-spot',
      'laser',
      'disco-lights',
      'strobe',
      'string-lights',
      'chandelier',
      'light',
    ],
    defaultRatePerDay: 1100,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['lighting-set', 'party-set', 'stage-set', 'ambience-set'],
    brands: ['Chauvet DJ', 'ADJ', 'Elation Lighting', 'Martin Professional'],
  },
  {
    matchers: [
      'led-wall',
      'projector',
      'projection-screen',
      'tvs-monitors',
      'camera',
      'livestream',
    ],
    defaultRatePerDay: 2000,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['video-set', 'presentation-set', 'livestream-set'],
    brands: ['Epson', 'BenQ', 'Optoma', 'Samsung', 'LG'],
  },
  {
    matchers: [
      'chafing-dishes',
      'serving-trays',
      'plates',
      'forks-and-spoons',
      'glassware',
      'soup-bowls',
      'wine-glasses',
      'coffee-percolators',
      'water-dispensers',
    ],
    defaultRatePerDay: 180,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['catering-set', 'buffet-set', 'dining-set'],
    brands: ['Winco', 'Cambro', 'Vollrath'],
  },
  {
    matchers: ['industrial-fans', 'mist-fans', 'air-coolers', 'portable-air-conditioners'],
    defaultRatePerDay: 850,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['cooling-set', 'comfort-set', 'outdoor-set'],
    brands: ['Iwata', 'Koppel', 'Dowell'],
  },
  {
    matchers: ['generator', 'extension-cords', 'power-distribution-boxes'],
    defaultRatePerDay: 1600,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['power-set', 'event-essentials-set'],
    brands: ['Honda', 'Yamaha', 'Hyundai Power'],
  },
  {
    matchers: [
      'tablecloth',
      'chair-covers',
      'table-runners',
      'centerpieces',
      'artificial-flowers',
      'balloon-arches',
      'wedding-arches',
      'drapes',
    ],
    defaultRatePerDay: 140,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['decor-set', 'wedding-set', 'theme-set', 'styling-set'],
    brands: ['Events by Design', 'Party Supply Pro', 'Flora Event Decor'],
  },
  {
    matchers: ['smoke-machines', 'bubble-machines', 'snow-machines', 'confetti-machines', 'cryo-jets'],
    defaultRatePerDay: 1800,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['effects-set', 'party-set', 'concert-set'],
    brands: ['Antari', 'Look Solutions', 'MagicFX'],
  },
];

const DEFAULT_PROFILE: CatalogProfile = {
  matchers: [],
  defaultRatePerDay: 250,
  eventTags: COMMON_EVENT_TAGS,
  setTags: ['event-essentials-set'],
  brands: ['Generic Event Supply'],
};

const SIZE_VARIANT_RULES: SizeVariantRule[] = [
  {
    matchers: ['folding-tables', 'foldable-tables', 'folding-table', 'foldable-table'],
    includeBaseType: false,
    variants: [
      { suffix: '4 ft', rate: 120 },
      { suffix: '6 ft', rate: 150 },
    ],
  },
  {
    matchers: ['rectangular-banquet-tables', 'rectangular-banquet'],
    includeBaseType: false,
    variants: [
      { suffix: '4 ft', rate: 180 },
      { suffix: '6 ft', rate: 250 },
      { suffix: '8 ft', rate: 320 },
    ],
  },
  {
    matchers: ['round-banquet-tables', 'round-banquet'],
    includeBaseType: false,
    variants: [
      { suffix: '4 ft', rate: 250 },
      { suffix: '5 ft', rate: 320 },
      { suffix: '6 ft', rate: 400 },
    ],
  },
];

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

  private static readonly EXCLUDED_UPLOAD_FOLDERS = new Set([
    'booking-documents',
  ]);

  private static readonly WORD_OVERRIDES: Record<string, string> = {
    pa: 'PA',
    dj: 'DJ',
    led: 'LED',
    vip: 'VIP',
    tvs: 'TVs',
    par: 'PAR',
    ac: 'AC',
  };

  private static readonly FOLDER_NAME_OVERRIDES: Record<string, string> = {
    'tiffany-chiavari': 'Tiffany / Chiavari',
    'tiffany-chiavari-chairs': 'Tiffany / Chiavari Chairs',
    'podium-lectern': 'Podium / Lectern',
    'runway-catwalk': 'Runway / Catwalk',
    'tvs-monitors': 'TVs / Monitors',
    'pa-speakers': 'PA Speakers',
    'pipe-and-drape-system': 'Pipe and Drape System',
  };

  private readonly uploadRootDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(ItemType)
    private readonly itemTypesRepo: Repository<ItemType>,
    @InjectRepository(ProductBrand)
    private readonly brandsRepo: Repository<ProductBrand>,
  ) {}

  async seed(): Promise<CatalogSeedResult> {
    let itemTypesCreated = 0;
    let itemTypesUpdated = 0;
    let itemTypesDeactivated = 0;
    let brandsCreated = 0;
    let itemTypesWithSeededPictures = 0;
    let itemTypesMissingSeededPictures = 0;

    const existingTypes = await this.itemTypesRepo.find();
    const itemTypeByName = new Map<string, ItemType>();

    for (const existingType of existingTypes) {
      itemTypeByName.set(existingType.name.trim().toLowerCase(), existingType);
    }

    const uploadFolders = this.getUploadFolders();
    const seededItemTypeNames = new Set<string>();
    const folderToTypeNames = new Map<string, string[]>();

    for (const folderName of uploadFolders) {
      const typeName = this.folderNameToTypeName(folderName);
      if (!typeName) continue;

      const profile = this.resolveProfile(folderName);
      const normalizedEventTags = this.normalizeTags(profile.eventTags);
      const normalizedSetTags = this.normalizeTags(profile.setTags);
      const seededPictureUrl = this.resolveSeedPictureUrl(typeName, folderName);
      const baseDefaultRatePerDay = this.resolveDefaultRatePerDay(
        folderName,
        profile.defaultRatePerDay,
      );
      const variants = this.resolveTypeVariants(
        folderName,
        typeName,
        baseDefaultRatePerDay,
      );

      const seededTypeNamesForFolder: string[] = [];

      for (const variant of variants) {
        const normalizedTypeName = variant.name.trim().toLowerCase();
        seededItemTypeNames.add(normalizedTypeName);
        seededTypeNamesForFolder.push(variant.name);

        const existingType = itemTypeByName.get(normalizedTypeName);
        const expectedDescription = variant.variantLabel
          ? `Seeded from uploads/${folderName} (${variant.variantLabel})`
          : `Seeded from uploads/${folderName}`;

        if (existingType) {
          const currentEventTags = this.normalizeTags(existingType.eventTags);
          const currentSetTags = this.normalizeTags(existingType.setTags);
          const shouldSyncPicture = Boolean(seededPictureUrl)
            && existingType.pictureUrl !== seededPictureUrl;

          const shouldUpdate =
            !this.sameTags(currentEventTags, normalizedEventTags)
            || !this.sameTags(currentSetTags, normalizedSetTags)
            || shouldSyncPicture
            || Number(existingType.defaultRatePerDay || 0) !== variant.defaultRatePerDay
            || existingType.description !== expectedDescription
            || existingType.isActive !== true;

          if (shouldUpdate) {
            existingType.eventTags = normalizedEventTags;
            existingType.setTags = normalizedSetTags;
            existingType.defaultRatePerDay = variant.defaultRatePerDay;
            existingType.description = expectedDescription;
            existingType.isActive = true;
            if (seededPictureUrl) {
              existingType.pictureUrl = seededPictureUrl;
            }
            await this.itemTypesRepo.save(existingType);
            itemTypesUpdated += 1;
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
            name: variant.name,
            description: expectedDescription,
            defaultRatePerDay: variant.defaultRatePerDay,
            eventTags: normalizedEventTags,
            setTags: normalizedSetTags,
            pictureUrl: seededPictureUrl,
            isActive: true,
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

      folderToTypeNames.set(folderName, seededTypeNamesForFolder);
    }

    if (this.parseBooleanFlag(process.env.SEED_DEACTIVATE_MISSING_ITEM_TYPES)) {
      for (const existingType of existingTypes) {
        const normalizedName = existingType.name.trim().toLowerCase();
        if (seededItemTypeNames.has(normalizedName)) continue;
        if (!existingType.isActive) continue;

        await this.itemTypesRepo.update(existingType.id, { isActive: false });
        itemTypesDeactivated += 1;
      }
    }

    const existingBrands = await this.brandsRepo.find();
    const brandKeySet = new Set<string>();

    for (const existingBrand of existingBrands) {
      brandKeySet.add(this.toBrandKey(existingBrand.itemTypeId, existingBrand.name));
    }

    for (const folderName of uploadFolders) {
      const seededTypeNamesForFolder = folderToTypeNames.get(folderName) || [];
      if (!seededTypeNamesForFolder.length) continue;

      const profile = this.resolveProfile(folderName);
      for (const typeName of seededTypeNamesForFolder) {
        const itemType = itemTypeByName.get(typeName.trim().toLowerCase());
        if (!itemType) continue;

        for (const brandName of profile.brands) {
          const brandKey = this.toBrandKey(itemType.id, brandName);
          if (brandKeySet.has(brandKey)) continue;

          await this.brandsRepo.save(
            this.brandsRepo.create({
              itemTypeId: itemType.id,
              name: brandName,
              description: `Seeded brand for ${typeName}`,
            }),
          );

          brandsCreated += 1;
          brandKeySet.add(brandKey);
        }
      }
    }

    return {
      itemTypesCreated,
      itemTypesUpdated,
      itemTypesDeactivated,
      brandsCreated,
      itemTypesWithSeededPictures,
      itemTypesMissingSeededPictures,
      itemTypesTotal: await this.itemTypesRepo.count(),
      brandsTotal: await this.brandsRepo.count(),
    };
  }

  private resolveSeedPictureUrl(typeName: string, preferredFolderName?: string): string | undefined {
    if (!fs.existsSync(this.uploadRootDir)) return undefined;

    const folderName = preferredFolderName || this.resolveTypeImageFolder(typeName);
    if (!folderName) return undefined;

    const folderPath = join(this.uploadRootDir, folderName);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return undefined;
    }

    const imageFileName = this.pickImageFileName(folderPath);
    if (!imageFileName) return undefined;

    return posix.join('/uploads', folderName, imageFileName);
  }

  private getUploadFolders(): string[] {
    if (!fs.existsSync(this.uploadRootDir)) return [];

    return fs.readdirSync(this.uploadRootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !CatalogSeedService.EXCLUDED_UPLOAD_FOLDERS.has(name))
      .sort((left, right) => left.localeCompare(right));
  }

  private folderNameToTypeName(folderName: string): string | null {
    const normalized = this.normalizeForPath(folderName);
    if (!normalized) return null;

    const explicitOverride = CatalogSeedService.FOLDER_NAME_OVERRIDES[normalized];
    if (explicitOverride) return explicitOverride;

    const words = normalized
      .split('-')
      .map((word) => word.trim())
      .filter(Boolean)
      .map((word) => CatalogSeedService.WORD_OVERRIDES[word] || this.capitalizeWord(word));

    if (!words.length) return null;
    return words.join(' ');
  }

  private capitalizeWord(word: string) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  private resolveProfile(folderName: string): CatalogProfile {
    const normalizedFolderName = this.normalizeForPath(folderName);
    for (const profile of CATALOG_PROFILES) {
      const matches = profile.matchers.some((matcher) => {
        if (typeof matcher === 'string') {
          return normalizedFolderName.includes(matcher);
        }
        return matcher.test(normalizedFolderName);
      });

      if (matches) {
        return profile;
      }
    }

    return DEFAULT_PROFILE;
  }

  private resolveDefaultRatePerDay(folderName: string, profileDefaultRate: number): number {
    const normalizedFolderName = this.normalizeForPath(folderName);
    let rate = profileDefaultRate;

    if (normalizedFolderName.includes('tent')) rate += 1200;
    if (normalizedFolderName.includes('air-conditioned')) rate += 1800;
    if (normalizedFolderName.includes('generator')) rate += 900;
    if (normalizedFolderName.includes('led-wall')) rate += 1800;
    if (normalizedFolderName.includes('chandelier')) rate += 450;
    if (normalizedFolderName.includes('microphone')) rate -= 400;
    if (normalizedFolderName.includes('extension-cords')) rate -= 120;
    if (normalizedFolderName.includes('forks-and-spoons')) rate -= 80;
    if (normalizedFolderName.includes('plates')) rate -= 100;

    return Math.max(50, Number(rate.toFixed(2)));
  }

  private resolveTypeVariants(
    folderName: string,
    baseTypeName: string,
    baseDefaultRatePerDay: number,
  ): CatalogTypeVariant[] {
    const normalizedFolderName = this.normalizeForPath(folderName);

    const matchedRule = SIZE_VARIANT_RULES.find((rule) =>
      rule.matchers.some((matcher) => this.matcherMatches(normalizedFolderName, matcher)),
    );

    if (!matchedRule) {
      return [
        {
          name: baseTypeName,
          defaultRatePerDay: baseDefaultRatePerDay,
        },
      ];
    }

    const variants: CatalogTypeVariant[] = matchedRule.variants.map((variant) => {
      const variantRate = Number(
        (
          variant.rate ??
          (baseDefaultRatePerDay + Number(variant.rateDelta || 0))
        ).toFixed(2),
      );

      return {
        name: `${baseTypeName} (${variant.suffix})`,
        defaultRatePerDay: Math.max(50, variantRate),
        variantLabel: variant.suffix,
      };
    });

    if (matchedRule.includeBaseType) {
      variants.unshift({
        name: baseTypeName,
        defaultRatePerDay: baseDefaultRatePerDay,
      });
    }

    return variants;
  }

  private matcherMatches(value: string, matcher: string | RegExp) {
    if (typeof matcher === 'string') {
      return value.includes(matcher);
    }

    return matcher.test(value);
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

  private parseBooleanFlag(input: unknown) {
    const normalized = String(input || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
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