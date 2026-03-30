import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddPackageTemplatesAndVendorPackages2026033000005
  implements MigrationInterface
{
  name = 'AddPackageTemplatesAndVendorPackages2026033000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAdminTemplates = await queryRunner.hasTable('admin_package_templates');
    if (!hasAdminTemplates) {
      await queryRunner.createTable(
        new Table({
          name: 'admin_package_templates',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'code', type: 'varchar', length: '80' },
            { name: 'name', type: 'varchar', length: '140' },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'isActive', type: 'tinyint', width: 1, default: '1' },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updatedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );

      await queryRunner.createIndex(
        'admin_package_templates',
        new TableIndex({
          name: 'IDX_admin_package_templates_code',
          columnNames: ['code'],
          isUnique: true,
        }),
      );
    }

    const hasAdminTemplateItems = await queryRunner.hasTable('admin_package_template_items');
    if (!hasAdminTemplateItems) {
      await queryRunner.createTable(
        new Table({
          name: 'admin_package_template_items',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'packageId', type: 'varchar', length: '36' },
            { name: 'itemTypeId', type: 'varchar', length: '36' },
            { name: 'requiredQty', type: 'int' },
            { name: 'suggestedUnitPrice', type: 'decimal', precision: 10, scale: 2, isNullable: true },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updatedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );

      await queryRunner.createIndex(
        'admin_package_template_items',
        new TableIndex({
          name: 'IDX_admin_package_template_items_unique',
          columnNames: ['packageId', 'itemTypeId'],
          isUnique: true,
        }),
      );

      await queryRunner.createForeignKeys('admin_package_template_items', [
        new TableForeignKey({
          columnNames: ['packageId'],
          referencedTableName: 'admin_package_templates',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['itemTypeId'],
          referencedTableName: 'item_types',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      ]);
    }

    const hasVendorPackages = await queryRunner.hasTable('vendor_packages');
    if (!hasVendorPackages) {
      await queryRunner.createTable(
        new Table({
          name: 'vendor_packages',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'vendorId', type: 'varchar', length: '36' },
            { name: 'basePackageId', type: 'varchar', length: '36', isNullable: true },
            { name: 'source', type: 'enum', enum: ['admin', 'vendor'], default: "'admin'" },
            { name: 'packageName', type: 'varchar', length: '160' },
            { name: 'hasOverride', type: 'tinyint', width: 1, default: '0' },
            {
              name: 'status',
              type: 'enum',
              enum: ['eligible', 'available', 'partially_available', 'disabled'],
              default: "'eligible'",
            },
            { name: 'statusDate', type: 'date', isNullable: true },
            { name: 'overrideMetadata', type: 'text', isNullable: true },
            { name: 'isActive', type: 'tinyint', width: 1, default: '1' },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updatedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );

      await queryRunner.createIndices('vendor_packages', [
        new TableIndex({ name: 'IDX_vendor_packages_vendor', columnNames: ['vendorId'] }),
        new TableIndex({
          name: 'IDX_vendor_packages_vendor_base',
          columnNames: ['vendorId', 'basePackageId'],
          isUnique: true,
        }),
      ]);

      await queryRunner.createForeignKeys('vendor_packages', [
        new TableForeignKey({
          columnNames: ['vendorId'],
          referencedTableName: 'vendors',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['basePackageId'],
          referencedTableName: 'admin_package_templates',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);
    }

    const hasVendorPackageItems = await queryRunner.hasTable('vendor_package_items');
    if (!hasVendorPackageItems) {
      await queryRunner.createTable(
        new Table({
          name: 'vendor_package_items',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'vendorPackageId', type: 'varchar', length: '36' },
            { name: 'itemTypeId', type: 'varchar', length: '36' },
            { name: 'requiredQty', type: 'int' },
            { name: 'unitPrice', type: 'decimal', precision: 10, scale: 2, isNullable: true },
            { name: 'source', type: 'enum', enum: ['base', 'override'], default: "'base'" },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updatedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );

      await queryRunner.createIndex(
        'vendor_package_items',
        new TableIndex({
          name: 'IDX_vendor_package_items_unique',
          columnNames: ['vendorPackageId', 'itemTypeId'],
          isUnique: true,
        }),
      );

      await queryRunner.createForeignKeys('vendor_package_items', [
        new TableForeignKey({
          columnNames: ['vendorPackageId'],
          referencedTableName: 'vendor_packages',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['itemTypeId'],
          referencedTableName: 'item_types',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('vendor_package_items')) {
      await queryRunner.dropTable('vendor_package_items');
    }

    if (await queryRunner.hasTable('vendor_packages')) {
      await queryRunner.dropTable('vendor_packages');
    }

    if (await queryRunner.hasTable('admin_package_template_items')) {
      await queryRunner.dropTable('admin_package_template_items');
    }

    if (await queryRunner.hasTable('admin_package_templates')) {
      await queryRunner.dropTable('admin_package_templates');
    }
  }
}