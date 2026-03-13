import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogSeedService } from '../seeds/catalog-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const result = await app.get(CatalogSeedService).seed();
    console.log('Catalog seed completed.');
    console.log(`Item types created: ${result.itemTypesCreated}`);
    console.log(`Brands created: ${result.brandsCreated}`);
    console.log(`Item types with seeded pictures: ${result.itemTypesWithSeededPictures}`);
    console.log(`Item types missing seeded pictures: ${result.itemTypesMissingSeededPictures}`);
    console.log(`Item types total: ${result.itemTypesTotal}`);
    console.log(`Brands total: ${result.brandsTotal}`);
  } catch (error) {
    console.error('Catalog seed failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();