import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryItemNotes2026032700001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(`
      SELECT * FROM \`INFORMATION_SCHEMA\`.\`COLUMNS\`
      WHERE \`TABLE_SCHEMA\` = DATABASE()
        AND \`TABLE_NAME\` = 'inventory_items'
        AND \`COLUMN_NAME\` = 'notes'
    `);
    if (!columnExists.length) {
      await queryRunner.query(`
        ALTER TABLE inventory_items
        ADD COLUMN notes TEXT NULL
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_items
      DROP COLUMN notes
    `);
  }
}
