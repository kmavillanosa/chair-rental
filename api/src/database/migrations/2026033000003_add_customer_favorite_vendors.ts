import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddCustomerFavoriteVendors2026033000003 implements MigrationInterface {
  name = 'AddCustomerFavoriteVendors2026033000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('customer_favorite_vendors');
    if (hasTable) return;

    await queryRunner.createTable(
      new Table({
        name: 'customer_favorite_vendors',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'customerUserId',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'vendorId',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndices('customer_favorite_vendors', [
      new TableIndex({
        name: 'IDX_customer_favorite_vendors_customer',
        columnNames: ['customerUserId'],
      }),
      new TableIndex({
        name: 'IDX_customer_favorite_vendors_vendor',
        columnNames: ['vendorId'],
      }),
      new TableIndex({
        name: 'IDX_customer_favorite_vendors_unique_pair',
        columnNames: ['customerUserId', 'vendorId'],
        isUnique: true,
      }),
    ]);

    await queryRunner.createForeignKeys('customer_favorite_vendors', [
      new TableForeignKey({
        columnNames: ['customerUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedTableName: 'vendors',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('customer_favorite_vendors');
    if (!hasTable) return;

    await queryRunner.dropTable('customer_favorite_vendors');
  }
}