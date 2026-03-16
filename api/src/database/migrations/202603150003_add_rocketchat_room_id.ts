import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRocketchatRoomId202603150003 implements MigrationInterface {
  name = 'AddRocketchatRoomId202603150003';

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
