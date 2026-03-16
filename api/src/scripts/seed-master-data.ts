import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogSeedService } from '../seeds/catalog-seed.service';
import { VendorDistanceSeedService } from '../seeds/vendor-distance-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const catalogResult = await app.get(CatalogSeedService).seed();
    const deliveryResult = await app.get(VendorDistanceSeedService).seed();

    console.log('Master data seed completed.');
    console.log(`Item types created: ${catalogResult.itemTypesCreated}`);
    console.log(`Item types updated: ${catalogResult.itemTypesUpdated}`);
    console.log(`Item types deactivated: ${catalogResult.itemTypesDeactivated}`);
    console.log(`Brands created: ${catalogResult.brandsCreated}`);
    console.log(`Item types with seeded pictures: ${catalogResult.itemTypesWithSeededPictures}`);
    console.log(`Item types missing seeded pictures: ${catalogResult.itemTypesMissingSeededPictures}`);
    console.log(`Item types total: ${catalogResult.itemTypesTotal}`);
    console.log(`Brands total: ${catalogResult.brandsTotal}`);
    console.log(`Vendors updated: ${deliveryResult.vendorsUpdated}`);
    console.log(`Delivery rates created: ${deliveryResult.deliveryRatesCreated}`);
    console.log(`Delivery rates updated: ${deliveryResult.deliveryRatesUpdated}`);
    console.log(`Delivery rates deleted: ${deliveryResult.deliveryRatesDeleted}`);
    console.log(`Delivery rates total: ${deliveryResult.deliveryRatesTotal}`);
  } catch (error) {
    console.error('Master data seed failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
