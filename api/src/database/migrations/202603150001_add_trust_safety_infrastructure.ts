import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrustSafetyInfrastructure202603150001
  implements MigrationInterface
{
  name = 'AddTrustSafetyInfrastructure202603150001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN lastLoginIp varchar(255) NULL,
        ADD COLUMN averageCustomerRating decimal(3,2) NOT NULL DEFAULT 0,
        ADD COLUMN totalCustomerRatings int NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE vendors
        MODIFY verificationStatus enum('pending_verification','verified_business','verified_owner','rejected','suspended') NOT NULL DEFAULT 'pending_verification',
        ADD COLUMN bankName varchar(255) NULL,
        ADD COLUMN bankAccountName varchar(255) NULL,
        ADD COLUMN bankAccountNumberMasked varchar(255) NULL,
        ADD COLUMN bankAccountLast4 varchar(4) NULL,
        ADD COLUMN bankAccountHash varchar(255) NULL,
        ADD COLUMN averageRating decimal(3,2) NOT NULL DEFAULT 0,
        ADD COLUMN totalRatings int NOT NULL DEFAULT 0,
        ADD COLUMN lowRatingFlag tinyint(1) NOT NULL DEFAULT 0,
        ADD COLUMN successfulCompletedOrders int NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE vendor_verification_status
        MODIFY status enum('pending_verification','verified_business','verified_owner','rejected','suspended') NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE bookings
        MODIFY paymentStatus enum('pending','unpaid','checkout_pending','paid','held','completed','failed','refunded','disputed') NOT NULL DEFAULT 'unpaid',
        ADD COLUMN depositPercentage decimal(5,2) NOT NULL DEFAULT 100,
        ADD COLUMN depositAmount decimal(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN remainingBalanceAmount decimal(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN totalPaidAmount decimal(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN escrowHeldAmount decimal(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN escrowReleasedAmount decimal(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN depositPaidAt datetime NULL,
        ADD COLUMN finalPaymentPaidAt datetime NULL,
        ADD COLUMN escrowHeldAt datetime NULL,
        ADD COLUMN escrowReleasedAt datetime NULL,
        ADD COLUMN vendorMarkedDeliveredAt datetime NULL,
        ADD COLUMN customerConfirmedDeliveryAt datetime NULL,
        ADD COLUMN customerConfirmedDeliveryByUserId varchar(36) NULL,
        ADD COLUMN createdFromIp varchar(255) NULL,
        ADD COLUMN fraudRiskScore int NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE vendor_payouts (
        id varchar(36) NOT NULL,
        vendorId varchar(36) NOT NULL,
        bookingId varchar(36) NOT NULL,
        grossAmount decimal(12,2) NOT NULL DEFAULT 0,
        platformFeeAmount decimal(12,2) NOT NULL DEFAULT 0,
        netAmount decimal(12,2) NOT NULL DEFAULT 0,
        depositHeldAmount decimal(12,2) NOT NULL DEFAULT 0,
        outstandingBalanceAmount decimal(12,2) NOT NULL DEFAULT 0,
        status enum('pending','held','ready','released','refunded','disputed','cancelled') NOT NULL DEFAULT 'pending',
        releaseOn datetime NULL,
        heldAt datetime NULL,
        releasedAt datetime NULL,
        disputeLockedAt datetime NULL,
        notes text NULL,
        metadata text NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY IDX_vendor_payouts_booking (bookingId),
        KEY IDX_vendor_payouts_vendor_status (vendorId, status)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE booking_messages (
        id varchar(36) NOT NULL,
        bookingId varchar(36) NOT NULL,
        senderUserId varchar(36) NOT NULL,
        senderRole enum('admin','vendor','customer') NOT NULL,
        content text NOT NULL,
        redactedContent text NOT NULL,
        flagReasons text NULL,
        isFlagged tinyint(1) NOT NULL DEFAULT 0,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_booking_messages_booking_created (bookingId, createdAt),
        KEY IDX_booking_messages_flagged (isFlagged)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE booking_reviews (
        id varchar(36) NOT NULL,
        bookingId varchar(36) NOT NULL,
        reviewerUserId varchar(36) NOT NULL,
        revieweeUserId varchar(36) NOT NULL,
        reviewerRole enum('admin','vendor','customer') NOT NULL,
        revieweeRole enum('admin','vendor','customer') NOT NULL,
        rating int NOT NULL,
        comment text NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY IDX_booking_reviews_booking_reviewer (bookingId, reviewerUserId),
        KEY IDX_booking_reviews_reviewee (revieweeUserId, revieweeRole)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE booking_delivery_proofs (
        id varchar(36) NOT NULL,
        bookingId varchar(36) NOT NULL,
        vendorId varchar(36) NOT NULL,
        photoUrl varchar(500) NOT NULL,
        signatureUrl varchar(500) NULL,
        note text NULL,
        capturedAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_booking_delivery_proofs_booking_created (bookingId, createdAt)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE booking_disputes (
        id varchar(36) NOT NULL,
        bookingId varchar(36) NOT NULL,
        openedByUserId varchar(36) NOT NULL,
        openedByRole enum('admin','vendor','customer') NOT NULL,
        reason text NOT NULL,
        status enum('open','under_review','resolved','rejected') NOT NULL DEFAULT 'open',
        outcome enum('refund_customer','release_payment_to_vendor','partial_refund') NULL,
        refundAmount decimal(12,2) NULL,
        resolutionNote text NULL,
        resolvedByUserId varchar(36) NULL,
        resolvedAt datetime NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_booking_disputes_booking_status (bookingId, status)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE booking_dispute_evidence (
        id varchar(36) NOT NULL,
        disputeId varchar(36) NOT NULL,
        uploadedByUserId varchar(36) NOT NULL,
        uploadedByRole enum('admin','vendor','customer') NOT NULL,
        fileUrl varchar(500) NOT NULL,
        note text NULL,
        metadata text NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_booking_dispute_evidence_dispute_created (disputeId, createdAt)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE fraud_alerts (
        id varchar(36) NOT NULL,
        type enum('booking_risk','off_platform_message','vendor_kyc','dispute','low_rating_vendor','ip_reuse','cancellation_pattern','unusual_booking_frequency') NOT NULL,
        severity enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
        status enum('open','under_review','resolved','dismissed') NOT NULL DEFAULT 'open',
        title varchar(180) NOT NULL,
        description text NOT NULL,
        userId varchar(36) NULL,
        vendorId varchar(36) NULL,
        bookingId varchar(36) NULL,
        messageId varchar(36) NULL,
        disputeId varchar(36) NULL,
        metadata text NULL,
        reviewedByUserId varchar(36) NULL,
        reviewedAt datetime NULL,
        resolutionNote text NULL,
        createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY IDX_fraud_alerts_status_created (status, createdAt),
        KEY IDX_fraud_alerts_type_severity (type, severity)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS fraud_alerts`);
    await queryRunner.query(`DROP TABLE IF EXISTS booking_dispute_evidence`);
    await queryRunner.query(`DROP TABLE IF EXISTS booking_disputes`);
    await queryRunner.query(`DROP TABLE IF EXISTS booking_delivery_proofs`);
    await queryRunner.query(`DROP TABLE IF EXISTS booking_reviews`);
    await queryRunner.query(`DROP TABLE IF EXISTS booking_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_payouts`);

    await queryRunner.query(`
      ALTER TABLE bookings
        MODIFY paymentStatus enum('unpaid','checkout_pending','paid','failed','refunded') NOT NULL DEFAULT 'unpaid',
        DROP COLUMN depositPercentage,
        DROP COLUMN depositAmount,
        DROP COLUMN remainingBalanceAmount,
        DROP COLUMN totalPaidAmount,
        DROP COLUMN escrowHeldAmount,
        DROP COLUMN escrowReleasedAmount,
        DROP COLUMN depositPaidAt,
        DROP COLUMN finalPaymentPaidAt,
        DROP COLUMN escrowHeldAt,
        DROP COLUMN escrowReleasedAt,
        DROP COLUMN vendorMarkedDeliveredAt,
        DROP COLUMN customerConfirmedDeliveryAt,
        DROP COLUMN customerConfirmedDeliveryByUserId,
        DROP COLUMN createdFromIp,
        DROP COLUMN fraudRiskScore
    `);

    await queryRunner.query(`
      ALTER TABLE vendor_verification_status
        MODIFY status enum('pending_verification','verified_business','verified_owner','rejected') NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE vendors
        MODIFY verificationStatus enum('pending_verification','verified_business','verified_owner','rejected') NOT NULL DEFAULT 'pending_verification',
        DROP COLUMN bankName,
        DROP COLUMN bankAccountName,
        DROP COLUMN bankAccountNumberMasked,
        DROP COLUMN bankAccountLast4,
        DROP COLUMN bankAccountHash,
        DROP COLUMN averageRating,
        DROP COLUMN totalRatings,
        DROP COLUMN lowRatingFlag,
        DROP COLUMN successfulCompletedOrders
    `);

    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN lastLoginIp,
        DROP COLUMN averageCustomerRating,
        DROP COLUMN totalCustomerRatings
    `);
  }
}