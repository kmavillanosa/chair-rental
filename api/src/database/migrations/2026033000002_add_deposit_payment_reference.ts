import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds depositPaymentReference to bookings.
 *
 * When a booking uses the downpayment_required flow, the first-leg checkout
 * generates a pay_xxx1 payment ID and the second-leg generates pay_xxx2.
 * paymentReference is overwritten to pay_xxx2 after the second checkout, so
 * the original pay_xxx1 must be stored separately in depositPaymentReference.
 * This allows executePayMongoRefund to issue two separate PayMongo refunds —
 * one against each original payment — when a two-leg booking is cancelled.
 */
export class AddDepositPaymentReference2026033000002 implements MigrationInterface {
  name = 'AddDepositPaymentReference2026033000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('bookings', 'depositPaymentReference'))) {
      await queryRunner.query(`
        ALTER TABLE bookings
          ADD COLUMN depositPaymentReference VARCHAR(100) NULL
          AFTER paymentReference
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('bookings', 'depositPaymentReference')) {
      await queryRunner.query(`
        ALTER TABLE bookings DROP COLUMN depositPaymentReference
      `);
    }
  }
}
