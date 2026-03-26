import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushSubscriptions2026032600001 implements MigrationInterface {
  name = 'AddPushSubscriptions2026032600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('push_subscriptions')) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE push_subscriptions (
        id varchar(36) NOT NULL,
        userId varchar(36) NOT NULL,
        endpoint varchar(500) NOT NULL,
        p256dh varchar(255) NOT NULL,
        auth varchar(255) NOT NULL,
        contentEncoding varchar(32) NULL,
        userAgent varchar(255) NULL,
        lastUsedAt datetime NULL,
        createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_push_subscriptions_endpoint (endpoint),
        KEY IDX_push_subscriptions_user_id (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('push_subscriptions'))) {
      return;
    }

    await queryRunner.query('DROP TABLE push_subscriptions');
  }
}
