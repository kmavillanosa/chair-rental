import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PackageEligibilitySeedService } from '../seeds/package-eligibility-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const result = await app.get(PackageEligibilitySeedService).seed();
    console.log('Package eligibility seed completed.');
    console.log(`Admin packages created: ${result.adminPackagesCreated}`);
    console.log(`Admin packages updated: ${result.adminPackagesUpdated}`);
    console.log(`Admin package items written: ${result.adminPackageItemsWritten}`);
    console.log(`Vendor packages created: ${result.vendorPackagesCreated}`);
    console.log(`Vendor packages updated: ${result.vendorPackagesUpdated}`);
    console.log(`Vendor package items written: ${result.vendorPackageItemsWritten}`);
    console.log(`Eligible packages: ${result.eligibleCount}`);
    console.log(`Available packages: ${result.availableCount}`);
    console.log(`Partially available packages: ${result.partiallyAvailableCount}`);
    console.log(`Disabled packages: ${result.disabledCount}`);
    console.log(`Vendors processed: ${result.vendorsProcessed}`);
    console.log(`Availability check date: ${result.seedAvailabilityDate}`);
  } catch (error) {
    console.error('Package eligibility seed failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();