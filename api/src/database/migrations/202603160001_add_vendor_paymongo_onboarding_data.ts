import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVendorPaymongoOnboardingData202603160001
  implements MigrationInterface
{
  name = 'AddVendorPaymongoOnboardingData202603160001';

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
