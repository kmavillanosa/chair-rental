import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddVendorReviews2026033000004 implements MigrationInterface {
  name = 'AddVendorReviews2026033000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('vendor_reviews');
    if (hasTable) return;

    await queryRunner.createTable(
      new Table({
        name: 'vendor_reviews',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'vendorId', type: 'varchar', length: '36' },
          { name: 'reviewerUserId', type: 'varchar', length: '36' },
          { name: 'rating', type: 'int' },
          { name: 'comment', type: 'text', isNullable: true },
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

    await queryRunner.createIndices('vendor_reviews', [
      new TableIndex({ name: 'IDX_vendor_reviews_vendor', columnNames: ['vendorId'] }),
      new TableIndex({ name: 'IDX_vendor_reviews_reviewer', columnNames: ['reviewerUserId'] }),
      new TableIndex({
        name: 'IDX_vendor_reviews_vendor_reviewer',
        columnNames: ['vendorId', 'reviewerUserId'],
        isUnique: true,
      }),
    ]);

    await queryRunner.createForeignKeys('vendor_reviews', [
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedTableName: 'vendors',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['reviewerUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('vendor_reviews');
    if (!hasTable) return;

    await queryRunner.dropTable('vendor_reviews');
  }
}