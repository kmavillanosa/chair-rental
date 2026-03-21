import { MigrationInterface, QueryRunner } from 'typeorm';

export class Add202603211122VendorPricingConfiguration
  implements MigrationInterface
{
  name = 'Add202603211122VendorPricingConfiguration';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_pricing_configs (
        id varchar(36) PRIMARY KEY,
        vendorId varchar(36) UNIQUE NOT NULL,
        deliveryFreeRadiusKm decimal(5,2) NOT NULL DEFAULT 2,
        deliveryPerKmEnabled tinyint(1) NOT NULL DEFAULT 0,
        deliveryPerKmRate decimal(10,2) NULL,
        helpersEnabled tinyint(1) NOT NULL DEFAULT 1,
        helpersPricingMode enum('tiered','fixed','hourly') NOT NULL DEFAULT 'tiered',
        helpersFixedPrice decimal(10,2) NULL,
        helpersHourlyRate decimal(10,2) NULL,
        helpersMaxCount int NOT NULL DEFAULT 3,
        waitingFeePerHour decimal(10,2) NOT NULL DEFAULT 100,
        nightSurcharge decimal(10,2) NOT NULL DEFAULT 0,
        minOrderAmount decimal(12,2) NOT NULL DEFAULT 0,
        isActive tinyint(1) NOT NULL DEFAULT 1,
        notes text NULL,
        createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vendorId) REFERENCES vendors(id) ON DELETE CASCADE,
        UNIQUE KEY unique_vendor_pricing(vendorId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_delivery_pricing_tiers (
        id varchar(36) PRIMARY KEY,
        pricingConfigId varchar(36) NOT NULL,
        minDistanceKm decimal(5,2) NOT NULL,
        maxDistanceKm decimal(5,2) NOT NULL,
        priceAmount decimal(12,2) NOT NULL,
        sortOrder int NOT NULL DEFAULT 0,
        FOREIGN KEY (pricingConfigId) REFERENCES vendor_pricing_configs(id) ON DELETE CASCADE,
        KEY idx_pricing_config(pricingConfigId),
        UNIQUE KEY unique_tier_range(pricingConfigId, minDistanceKm, maxDistanceKm)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_helper_pricing_tiers (
        id varchar(36) PRIMARY KEY,
        pricingConfigId varchar(36) NOT NULL,
        helperCount int NOT NULL,
        priceAmount decimal(12,2) NOT NULL,
        sortOrder int NOT NULL DEFAULT 0,
        FOREIGN KEY (pricingConfigId) REFERENCES vendor_pricing_configs(id) ON DELETE CASCADE,
        KEY idx_pricing_config(pricingConfigId),
        UNIQUE KEY unique_helper_tier(pricingConfigId, helperCount)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_helper_pricing_tiers`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_delivery_pricing_tiers`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_pricing_configs`);
  }
}
