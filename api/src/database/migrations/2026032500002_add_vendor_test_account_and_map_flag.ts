import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVendorTestAccountAndMapFlag2026032500002
  implements MigrationInterface
{
  name = 'AddVendorTestAccountAndMapFlag2026032500002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(`
      SELECT * FROM \`INFORMATION_SCHEMA\`.\`COLUMNS\`
      WHERE \`TABLE_SCHEMA\` = DATABASE()
        AND \`TABLE_NAME\` = 'vendors'
        AND \`COLUMN_NAME\` = 'isTestAccount'
    `);
    if (!columnExists.length) {
      await queryRunner.query(`
        ALTER TABLE vendors
        ADD COLUMN isTestAccount tinyint(1) NOT NULL DEFAULT 0
      `);
    }

    const indexExists = await queryRunner.query(`
      SELECT * FROM \`INFORMATION_SCHEMA\`.\`STATISTICS\`
      WHERE \`TABLE_SCHEMA\` = DATABASE()
        AND \`TABLE_NAME\` = 'vendors'
        AND \`INDEX_NAME\` = 'IDX_vendors_is_test_account'
    `);
    if (!indexExists.length) {
      await queryRunner.query(`
        CREATE INDEX IDX_vendors_is_test_account ON vendors (isTestAccount)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IDX_vendors_is_test_account ON vendors
    `);

    await queryRunner.query(`
      ALTER TABLE vendors
      DROP COLUMN isTestAccount
    `);
  }
}
