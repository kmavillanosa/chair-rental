import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { VendorPayment } from './entities/vendor-payment.entity';
import { VendorPayout } from './entities/vendor-payout.entity';
import { DeliveryRate } from './entities/delivery-rate.entity';
import { VendorPricingConfig } from './entities/vendor-pricing-config.entity';
import { VendorDeliveryPricingTier } from './entities/vendor-delivery-pricing-tier.entity';
import { VendorHelperPricingTier } from './entities/vendor-helper-pricing-tier.entity';
import { PricingConfigBootstrapService } from './services/pricing-config-bootstrap.service';
import { PricingCalculationService } from './services/pricing-calculation.service';
import { VendorPricingConfigService } from './services/vendor-pricing-config.service';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VendorPayment,
      VendorPayout,
      DeliveryRate,
      VendorPricingConfig,
      VendorDeliveryPricingTier,
      VendorHelperPricingTier,
    ]),
    forwardRef(() => VendorsModule),
  ],
  providers: [
    PaymentsService,
    PricingConfigBootstrapService,
    PricingCalculationService,
    VendorPricingConfigService,
  ],
  controllers: [PaymentsController],
  exports: [
    PaymentsService,
    PricingConfigBootstrapService,
    PricingCalculationService,
    VendorPricingConfigService,
  ],
})
export class PaymentsModule {}
