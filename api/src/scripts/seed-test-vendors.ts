import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TestVendorsSeedService } from '../seeds/test-vendors-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const result = await app.get(TestVendorsSeedService).seed();
    console.log('Test vendors seed completed.');
    console.log(`Users created: ${result.usersCreated}`);
    console.log(`Vendors created: ${result.vendorsCreated}`);
    console.log(`Vendors updated: ${result.vendorsUpdated}`);
    console.log(`Inventory items created: ${result.inventoryItemsCreated}`);
    console.log(`Vendor items created: ${result.vendorItemsCreated}`);
    console.log(`Delivery rates created: ${result.deliveryRatesCreated}`);
    console.log(`Delivery rates updated: ${result.deliveryRatesUpdated}`);
    console.log(`Delivery rates deleted: ${result.deliveryRatesDeleted}`);
    console.log(`Pricing configs created: ${result.pricingConfigsCreated}`);
    console.log(`Pricing configs updated: ${result.pricingConfigsUpdated}`);
    console.log(`Delivery pricing tiers written: ${result.deliveryPricingTiersWritten}`);
    console.log(`Helper pricing tiers written: ${result.helperPricingTiersWritten}`);
    console.log(`Total test vendors: ${result.totalTestVendors}`);
  } catch (error) {
    console.error('Test vendors seed failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
