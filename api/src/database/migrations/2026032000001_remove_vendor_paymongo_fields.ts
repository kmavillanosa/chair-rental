import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveVendorPaymongoFields2026032000001
  implements MigrationInterface
{
  name = 'RemoveVendorPaymongoFields2026032000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('vendors', 'paymongoOnboardingData')) {
      await queryRunner.query(`
        ALTER TABLE vendors
          DROP COLUMN paymongoOnboardingData
      `);
    }

    if (await queryRunner.hasColumn('vendors', 'paymongoOnboardedAt')) {
      await queryRunner.query(`
        ALTER TABLE vendors
          DROP COLUMN paymongoOnboardedAt
      `);
    }

    if (await queryRunner.hasColumn('vendors', 'paymongoOnboardingError')) {
      await queryRunner.query(`
        ALTER TABLE vendors
          DROP COLUMN paymongoOnboardingError
      `);
    }

    if (await queryRunner.hasColumn('vendors', 'paymongoOnboardingStatus')) {
      await queryRunner.query(`
        ALTER TABLE vendors
          DROP COLUMN paymongoOnboardingStatus
      `);
    }

    if (await queryRunner.hasColumn('vendors', 'paymongoMerchantId')) {
      await queryRunner.query(`
        ALTER TABLE vendors
          DROP COLUMN paymongoMerchantId
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('vendors', 'paymongoMerchantId'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN paymongoMerchantId varchar(255) NULL UNIQUE
      `);
    }

    if (!(await queryRunner.hasColumn('vendors', 'paymongoOnboardingStatus'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN paymongoOnboardingStatus enum('not_started','processing','provisioned','failed') NOT NULL DEFAULT 'not_started'
      `);
    }

    if (!(await queryRunner.hasColumn('vendors', 'paymongoOnboardingError'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN paymongoOnboardingError text NULL
      `);
    }

    if (!(await queryRunner.hasColumn('vendors', 'paymongoOnboardedAt'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN paymongoOnboardedAt datetime NULL
      `);
    }

    if (!(await queryRunner.hasColumn('vendors', 'paymongoOnboardingData'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN paymongoOnboardingData longtext NULL
      `);
    }
  }
}
