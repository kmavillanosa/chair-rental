import { IsEnum } from 'class-validator';
import { BookingStatus } from '../entities/booking.entity';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
