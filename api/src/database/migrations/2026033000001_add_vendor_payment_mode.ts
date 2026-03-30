import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds vendor-configurable payment mode (full vs. downpayment) and the
 * corresponding DOWNPAYMENT_PAID status to bookings.
 *
 * Vendor fields:
 *   - paymentMode  ENUM('full_payment','downpayment_required') DEFAULT 'full_payment'
 *   - downpaymentPercent  DECIMAL(5,2) DEFAULT 30.00  (1–99, %)
 *
 * Booking change:
 *   - Adds 'downpayment_paid' to the paymentStatus ENUM so two-step payment
 *     flows can be tracked accurately.
 */
export class AddVendorPaymentMode2026033000001 implements MigrationInterface {
  name = 'AddVendorPaymentMode2026033000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Vendor: payment mode ──────────────────────────────────────────────────
    if (!(await queryRunner.hasColumn('vendors', 'paymentMode'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN paymentMode ENUM('full_payment','downpayment_required')
            NOT NULL DEFAULT 'full_payment'
          AFTER paymongoMerchantId
      `);
    }

    // ── Vendor: downpayment percentage (only meaningful when mode = downpayment_required) ─
    if (!(await queryRunner.hasColumn('vendors', 'downpaymentPercent'))) {
      await queryRunner.query(`
        ALTER TABLE vendors
          ADD COLUMN downpaymentPercent DECIMAL(5,2) NOT NULL DEFAULT 30.00
          AFTER paymentMode
      `);
    }

    // ── Booking: extend paymentStatus ENUM to add 'downpayment_paid' ─────────
    // We rebuild the full ENUM definition to include the new value.
    // The existing values are preserved; MySQL requires listing all values.
    await queryRunner.query(`
      ALTER TABLE bookings
        MODIFY COLUMN paymentStatus
          ENUM(
            'pending',
            'unpaid',
            'checkout_pending',
            'paid',
            'downpayment_paid',
            'held',
            'completed',
            'failed',
            'refunded',
            'disputed'
          ) NOT NULL DEFAULT 'unpaid'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove 'downpayment_paid' from booking paymentStatus ENUM
    // Any row with that value must no longer exist before rolling back.
    await queryRunner.query(`
      ALTER TABLE bookings
        MODIFY COLUMN paymentStatus
          ENUM(
            'pending',
            'unpaid',
            'checkout_pending',
            'paid',
            'held',
            'completed',
            'failed',
            'refunded',
            'disputed'
          ) NOT NULL DEFAULT 'unpaid'
    `);

    if (await queryRunner.hasColumn('vendors', 'downpaymentPercent')) {
      await queryRunner.query(`
        ALTER TABLE vendors DROP COLUMN downpaymentPercent
      `);
    }

    if (await queryRunner.hasColumn('vendors', 'paymentMode')) {
      await queryRunner.query(`
        ALTER TABLE vendors DROP COLUMN paymentMode
      `);
    }
  }
}
