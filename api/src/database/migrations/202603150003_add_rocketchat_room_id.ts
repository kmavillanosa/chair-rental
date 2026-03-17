import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRocketchatRoomId2026031500030 implements MigrationInterface {
  name = 'AddRocketchatRoomId2026031500030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bookings
        ADD COLUMN rocketchatRoomId varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bookings
        DROP COLUMN rocketchatRoomId
    `);
  }
}
