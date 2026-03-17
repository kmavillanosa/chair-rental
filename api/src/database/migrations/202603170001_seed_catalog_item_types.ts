import { MigrationInterface, QueryRunner } from 'typeorm';
import { CATALOG_SEED_DATA } from '../../seeds/catalog.seed-data';

const CATEGORY_DEFAULT_RATES: Record<string, number> = {
  Chairs: 80,
  Tables: 220,
  'Tents / Shelters': 3500,
  'Stage Equipment': 1800,
  'Sound System Equipment': 1400,
  'Lighting Equipment': 1100,
  'Video Equipment': 2000,
  'Catering Equipment': 180,
  'Climate / Cooling Equipment': 850,
  'Power Equipment': 1600,
  'Decoration Equipment': 140,
  'Event Effects Equipment': 1800,
};

type SeededItemType = {
  name: string;
  description: string;
  defaultRatePerDay: number;
  eventTags: string;
  setTags: string;
};

export class SeedCatalogItemTypes2026031700010 implements MigrationInterface {
  name = 'SeedCatalogItemTypes2026031700010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('item_types'))) {
      return;
    }

    const seedRows = this.buildSeedRows();

    if (!seedRows.length) {
      return;
    }

    const placeholders = seedRows
      .map(
        () => '(UUID(), ?, ?, NULL, ?, CAST(? AS JSON), CAST(? AS JSON), 1, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))',
      )
      .join(', ');

    const parameters = seedRows.flatMap((row) => [
      row.name,
      row.description,
      row.defaultRatePerDay,
      row.eventTags,
      row.setTags,
    ]);

    await queryRunner.query(
      `
        INSERT IGNORE INTO item_types (
          id,
          name,
          description,
          pictureUrl,
          defaultRatePerDay,
          eventTags,
          setTags,
          isActive,
          createdAt,
          updatedAt
        )
        VALUES ${placeholders}
      `,
      parameters,
    );
  }

  public async down(): Promise<void> {
    return;
  }

  private buildSeedRows(): SeededItemType[] {
    return CATALOG_SEED_DATA.flatMap((category) => {
      const defaultRatePerDay = CATEGORY_DEFAULT_RATES[category.category] ?? 0;

      return category.types.map((typeName) => ({
        name: typeName,
        description: `${category.category} catalog item type`,
        defaultRatePerDay,
        eventTags: JSON.stringify(category.eventTags),
        setTags: JSON.stringify(category.setTags),
      }));
    });
  }
}