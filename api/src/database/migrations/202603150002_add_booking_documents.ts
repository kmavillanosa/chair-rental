import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingDocuments2026031500020 implements MigrationInterface {
  name = 'AddBookingDocuments2026031500020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('booking_documents'))) {
      await queryRunner.query(`
        CREATE TABLE booking_documents (
          id varchar(36) NOT NULL,
          bookingId varchar(36) NOT NULL,
          documentType enum('contract','receipt') NOT NULL,
          issuedTo enum('customer','vendor','both') NOT NULL,
          title varchar(180) NOT NULL,
          fileName varchar(180) NOT NULL,
          fileUrl varchar(500) NOT NULL,
          filePath varchar(500) NOT NULL,
          fileHash varchar(128) NOT NULL,
          signature varchar(128) NOT NULL,
          signatureAlgorithm varchar(32) NOT NULL DEFAULT 'HMAC-SHA256',
          signaturePayloadHash varchar(128) NOT NULL,
          generatedAt datetime NOT NULL,
          metadata text NULL,
          createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (id),
          UNIQUE KEY IDX_booking_documents_booking_type_issued_to (bookingId, documentType, issuedTo),
          KEY IDX_booking_documents_generated_at (generatedAt)
        ) ENGINE=InnoDB
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS booking_documents`);
  }
}
