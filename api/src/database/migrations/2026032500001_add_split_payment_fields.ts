import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSplitPaymentFields2026032500001 implements MigrationInterface {
  name = 'AddSplitPaymentFields2026032500001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add paymongoMerchantId to vendors (vendor's PayMongo child merchant/org ID for split transfers)
    if (!(await queryRunner.hasColumn('vendors', 'paymongoMerchantId'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN paymongoMerchantId varchar(100) NULL UNIQUE
      `);
    }

    // Add splitPaymentSnapshot to bookings (immutable JSON snapshot of split config at checkout creation)
    if (!(await queryRunner.hasColumn('bookings', 'splitPaymentSnapshot'))) {
      await queryRunner.query(`
        ALTER TABLE bookings
          ADD COLUMN splitPaymentSnapshot text NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('bookings', 'splitPaymentSnapshot')) {
      await queryRunner.query(`
        ALTER TABLE bookings
          DROP COLUMN splitPaymentSnapshot
      `);
    }

    if (await queryRunner.hasColumn('vendors', 'paymongoMerchantId')) {
      await queryRunner.query(`
        ALTER TABLE vendors
          DROP COLUMN paymongoMerchantId
      `);
    }
  }
}
