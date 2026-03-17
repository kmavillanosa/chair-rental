import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVendorPaymongoOnboardingData2026031600010
  implements MigrationInterface
{
  name = 'AddVendorPaymongoOnboardingData2026031600010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendors
        ADD COLUMN paymongoOnboardingData longtext NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendors
        DROP COLUMN paymongoOnboardingData
    `);
  }
}
