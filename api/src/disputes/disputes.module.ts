import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingDispute } from './entities/booking-dispute.entity';
import { BookingDisputeEvidence } from './entities/booking-dispute-evidence.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { VendorPayout } from '../payments/entities/vendor-payout.entity';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingDispute,
      BookingDisputeEvidence,
      Booking,
      VendorPayout,
    ]),
    FraudModule,
  ],
  providers: [DisputesService],
  controllers: [DisputesController],
  exports: [DisputesService],
})
export class DisputesModule {}