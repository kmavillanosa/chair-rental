import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { VendorDistanceSeedService } from '../seeds/vendor-distance-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const result = await app.get(VendorDistanceSeedService).seed();
    console.log('Vendor distance seed completed.');
    console.log(`Vendors updated: ${result.vendorsUpdated}`);
    console.log(`Delivery rates created: ${result.deliveryRatesCreated}`);
    console.log(`Vendors total: ${result.vendorsTotal}`);
    console.log(`Delivery rates total: ${result.deliveryRatesTotal}`);
  } catch (error) {
    console.error('Vendor distance seed failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();