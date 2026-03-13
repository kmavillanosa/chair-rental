import api from './axios';
import type { Booking, BookingStatus } from '../types';

export type BookingCancellationPreview = {
  bookingId: string;
  policyCode:
    | 'full_refund_3_days'
    | 'half_refund_24_hours'
    | 'same_day_no_refund'
    | 'vendor_or_admin_full_refund';
  refundPercent: number;
  refundAmount: number;
  daysBeforeStartDate: number;
  isSameDayBooking: boolean;
  isPaidBooking: boolean;
};

export const getMyBookings = () => api.get<Booking[]>('/bookings/my').then(r => r.data);
export const getVendorBookings = () => api.get<Booking[]>('/bookings/vendor').then(r => r.data);
export const checkAvailability = (vendorId: string, startDate: string, endDate: string) =>
  api.get(`/bookings/vendor/${vendorId}/availability`, { params: { startDate, endDate } }).then(r => r.data);
export const createBooking = (data: object) => api.post<Booking>('/bookings', data).then(r => r.data);
export const createBookingPaymentCheckout = (id: string) =>
  api.post<Booking>(`/bookings/${id}/payment/checkout`).then((r) => r.data);
export const verifyBookingPayment = (id: string, checkoutSessionId?: string) =>
  api
    .post<Booking>(`/bookings/${id}/payment/verify`, { checkoutSessionId })
    .then((r) => r.data);
export const getBookingCancellationPreview = (id: string) =>
  api
    .get<BookingCancellationPreview>(`/bookings/${id}/cancellation-preview`)
    .then((r) => r.data);
export const updateBookingStatus = (id: string, status: BookingStatus) =>
  api.patch<Booking>(`/bookings/${id}/status`, { status }).then(r => r.data);
