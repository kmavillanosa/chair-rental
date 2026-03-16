import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { VendorPayment } from './entities/vendor-payment.entity';
import { VendorPayout } from './entities/vendor-payout.entity';
import { DeliveryRate } from './entities/delivery-rate.entity';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [TypeOrmModule.forFeature([VendorPayment, VendorPayout, DeliveryRate]), VendorsModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
