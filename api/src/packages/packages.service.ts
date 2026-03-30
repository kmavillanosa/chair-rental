import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { AdminPackageTemplate } from './entities/admin-package-template.entity';
import { AdminPackageTemplateItem } from './entities/admin-package-template-item.entity';
import { VendorPackage, VendorPackageStatus } from './entities/vendor-package.entity';
import { VendorPackageItem } from './entities/vendor-package-item.entity';
import { ItemType } from '../item-types/entities/item-type.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { UpsertAdminPackageTemplateDto } from './dto/upsert-admin-package-template.dto';

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(AdminPackageTemplate)
    private readonly adminTemplateRepo: Repository<AdminPackageTemplate>,
    @InjectRepository(AdminPackageTemplateItem)
    private readonly adminTemplateItemRepo: Repository<AdminPackageTemplateItem>,
    @InjectRepository(ItemType)
    private readonly itemTypeRepo: Repository<ItemType>,
    @InjectRepository(VendorPackage)
    private readonly vendorPackageRepo: Repository<VendorPackage>,
    @InjectRepository(VendorPackageItem)
    private readonly vendorPackageItemRepo: Repository<VendorPackageItem>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    private readonly dataSource: DataSource,
  ) {}

  async listAdminTemplates(includeInactive = true) {
    const templates = await this.adminTemplateRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!templates.length) return [];

    const templateIds = templates.map((template) => template.id);
    const items = await this.adminTemplateItemRepo.find({
      where: { packageId: In(templateIds) },
      relations: ['itemType'],
      order: { createdAt: 'ASC' },
    });

    const itemsByPackageId = new Map<string, AdminPackageTemplateItem[]>();
    for (const item of items) {
      const packageItems = itemsByPackageId.get(item.packageId) || [];
      packageItems.push(item);
      itemsByPackageId.set(item.packageId, packageItems);
    }

    return templates.map((template) => ({
      ...template,
      items: itemsByPackageId.get(template.id) || [],
    }));
  }

  async createAdminTemplate(payload: UpsertAdminPackageTemplateDto) {
    const normalizedCode = this.normalizeCode(payload.code);
    const codeOwner = await this.adminTemplateRepo.findOne({ where: { code: normalizedCode } });
    if (codeOwner) {
      throw new BadRequestException('Template code already exists');
    }

    await this.assertItemTypesExist(payload.items.map((item) => item.itemTypeId));

    const templateId = await this.dataSource.transaction(async (manager) => {
      const template = manager.create(AdminPackageTemplate, {
        code: normalizedCode,
        name: payload.name.trim(),
        description: this.normalizeDescription(payload.description),
        isActive: payload.isActive ?? true,
      });
      const savedTemplate = await manager.save(template);

      const uniqueItems = this.ensureUniqueItems(payload.items);
      const rows = uniqueItems.map((item) => manager.create(AdminPackageTemplateItem, {
        packageId: savedTemplate.id,
        itemTypeId: item.itemTypeId,
        requiredQty: Math.round(Number(item.requiredQty)),
        suggestedUnitPrice:
          item.suggestedUnitPrice == null ? null : Number(item.suggestedUnitPrice),
      }));
      await manager.save(rows);

      return savedTemplate.id;
    });

    return this.getAdminTemplateById(templateId);
  }

  async updateAdminTemplate(id: string, payload: UpsertAdminPackageTemplateDto) {
    const existing = await this.adminTemplateRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Admin package template not found');
    }

    const normalizedCode = this.normalizeCode(payload.code);
    const codeOwner = await this.adminTemplateRepo.findOne({ where: { code: normalizedCode } });
    if (codeOwner && codeOwner.id !== id) {
      throw new BadRequestException('Template code already exists');
    }

    await this.assertItemTypesExist(payload.items.map((item) => item.itemTypeId));

    await this.dataSource.transaction(async (manager) => {
      existing.code = normalizedCode;
      existing.name = payload.name.trim();
      existing.description = this.normalizeDescription(payload.description);
      existing.isActive = payload.isActive ?? existing.isActive;
      await manager.save(existing);

      await manager.delete(AdminPackageTemplateItem, { packageId: id });

      const uniqueItems = this.ensureUniqueItems(payload.items);
      const rows = uniqueItems.map((item) => manager.create(AdminPackageTemplateItem, {
        packageId: id,
        itemTypeId: item.itemTypeId,
        requiredQty: Math.round(Number(item.requiredQty)),
        suggestedUnitPrice:
          item.suggestedUnitPrice == null ? null : Number(item.suggestedUnitPrice),
      }));
      await manager.save(rows);
    });

    return this.getAdminTemplateById(id);
  }

  async removeAdminTemplate(id: string) {
    const existing = await this.adminTemplateRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Admin package template not found');
    }

    await this.adminTemplateRepo.delete(id);
    return { id, removed: true };
  }

  async listVendorPackagesForUser(userId: string, includeInactive = true) {
    const vendor = await this.findVendorByUserId(userId);
    return this.listVendorPackagesByVendorId(vendor.id, includeInactive, true);
  }

  async updateVendorPackageActiveForUser(userId: string, packageId: string, isActive: boolean) {
    const vendor = await this.findVendorByUserId(userId);
    const vendorPackage = await this.vendorPackageRepo.findOne({
      where: { id: packageId, vendorId: vendor.id },
    });

    if (!vendorPackage) {
      throw new NotFoundException('Vendor package not found');
    }

    vendorPackage.isActive = Boolean(isActive);
    await this.vendorPackageRepo.save(vendorPackage);

    const [hydrated] = await this.hydrateVendorPackages([vendorPackage]);
    return hydrated;
  }

  async listPublicVendorPackages(vendorId: string) {
    return this.listVendorPackagesByVendorId(vendorId, false, false);
  }

  private async getAdminTemplateById(id: string) {
    const template = await this.adminTemplateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Admin package template not found');
    }

    const items = await this.adminTemplateItemRepo.find({
      where: { packageId: id },
      relations: ['itemType'],
      order: { createdAt: 'ASC' },
    });

    return {
      ...template,
      items,
    };
  }

  private async findVendorByUserId(userId: string) {
    const vendor = await this.vendorRepo.findOne({ where: { userId } });
    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }
    return vendor;
  }

  private async listVendorPackagesByVendorId(
    vendorId: string,
    includeInactive: boolean,
    includeDisabled: boolean,
  ) {
    const whereBase: FindOptionsWhere<VendorPackage> = {
      vendorId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const where: FindOptionsWhere<VendorPackage> = includeDisabled
      ? whereBase
      : {
          ...whereBase,
          status: In([
            VendorPackageStatus.ELIGIBLE,
            VendorPackageStatus.AVAILABLE,
            VendorPackageStatus.PARTIALLY_AVAILABLE,
          ]),
        };

    const packages = await this.vendorPackageRepo.find({
      where,
      relations: ['basePackage'],
      order: { packageName: 'ASC' },
    });

    return this.hydrateVendorPackages(packages);
  }

  private async hydrateVendorPackages(packages: VendorPackage[]) {
    if (!packages.length) return [];

    const packageIds = packages.map((vendorPackage) => vendorPackage.id);
    const items = await this.vendorPackageItemRepo.find({
      where: { vendorPackageId: In(packageIds) },
      relations: ['itemType'],
      order: { createdAt: 'ASC' },
    });

    const itemsByPackageId = new Map<string, VendorPackageItem[]>();
    for (const item of items) {
      const packageItems = itemsByPackageId.get(item.vendorPackageId) || [];
      packageItems.push(item);
      itemsByPackageId.set(item.vendorPackageId, packageItems);
    }

    return packages.map((vendorPackage) => ({
      ...vendorPackage,
      items: itemsByPackageId.get(vendorPackage.id) || [],
    }));
  }

  private normalizeCode(input: string) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  private normalizeDescription(input?: string | null) {
    const description = String(input || '').trim();
    return description ? description : null;
  }

  private ensureUniqueItems(items: UpsertAdminPackageTemplateDto['items']) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.itemTypeId)) {
        throw new BadRequestException('Duplicate itemTypeId found in items');
      }
      seen.add(item.itemTypeId);
    }
    return items;
  }

  private async assertItemTypesExist(itemTypeIds: string[]) {
    const uniqueItemTypeIds = [...new Set(itemTypeIds)];
    const itemTypes = await this.itemTypeRepo.find({ where: { id: In(uniqueItemTypeIds) } });
    if (itemTypes.length !== uniqueItemTypeIds.length) {
      throw new BadRequestException('One or more itemTypeId values do not exist');
    }
  }
}