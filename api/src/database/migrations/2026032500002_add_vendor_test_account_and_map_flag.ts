import { MigrationInterface, QueryRunner } from 'typeorm';

export class Add2026032500002VendorTestAccountAndMapFlag
  implements MigrationInterface
{
  name = 'Add2026032500002VendorTestAccountAndMapFlag';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendors
      ADD COLUMN isTestAccount tinyint(1) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_vendors_is_test_account ON vendors (isTestAccount)
    `);
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
