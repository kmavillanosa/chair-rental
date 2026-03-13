import api from './axios';
import type { Booking, BookingStatus } from '../types';

export const getMyBookings = () => api.get<Booking[]>('/bookings/my').then(r => r.data);
export const getVendorBookings = () => api.get<Booking[]>('/bookings/vendor').then(r => r.data);
export const checkAvailability = (vendorId: string, startDate: string, endDate: string) =>
  api.get(`/bookings/vendor/${vendorId}/availability`, { params: { startDate, endDate } }).then(r => r.data);
export const createBooking = (data: object) => api.post<Booking>('/bookings', data).then(r => r.data);
export const updateBookingStatus = (id: string, status: BookingStatus) =>
  api.patch<Booking>(`/bookings/${id}/status`, { status }).then(r => r.data);
