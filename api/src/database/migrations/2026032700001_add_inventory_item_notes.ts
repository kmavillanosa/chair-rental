import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryItemNotes2026032700001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_items
      ADD COLUMN notes TEXT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_items
      DROP COLUMN notes
    `);
  }
}
