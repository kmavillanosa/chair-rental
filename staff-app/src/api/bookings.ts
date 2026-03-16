import api from './axios';
import type {
  Booking,
  BookingDispute,
  BookingDocument,
  BookingMessage,
  BookingReview,
  BookingStatus,
} from '../types';

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
export const createBooking = (data: object) => api.post<Booking>('/bookings', data).then(r => r.data);
export const createBookingPaymentCheckout = (id: string) =>
  api.post<Booking>(`/bookings/${id}/payment/checkout`).then((r) => r.data);

export const createBookingRemainingBalanceCheckout = (id: string) =>
  api
    .post<Booking>(`/bookings/${id}/payment/remaining-balance/checkout`)
    .then((r) => r.data);

export const verifyBookingPayment = (id: string, checkoutSessionId?: string) =>
  api
    .post<Booking>(`/bookings/${id}/payment/verify`, { checkoutSessionId })
    .then((r) => r.data);

export const verifyBookingRemainingBalancePayment = (
  id: string,
  checkoutSessionId?: string,
) =>
  api
    .post<Booking>(`/bookings/${id}/payment/remaining-balance/verify`, {
      checkoutSessionId,
    })
    .then((r) => r.data);

export const uploadBookingDeliveryProof = (
  bookingId: string,
  payload: FormData | { photoUrl: string; signatureUrl?: string; note?: string },
) => {
  if (payload instanceof FormData) {
    return api
      .post<Booking>(`/bookings/${bookingId}/delivery-proof`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  }

  return api
    .post<Booking>(`/bookings/${bookingId}/delivery-proof`, payload)
    .then((r) => r.data);
};

export const getBookingMessages = (id: string) =>
  api.get<BookingMessage[]>(`/bookings/${id}/messages`).then((r) => r.data);

export const sendBookingMessage = (id: string, content: string) =>
  api
    .post<BookingMessage>(`/bookings/${id}/messages`, { content })
    .then((r) => r.data);

export const getBookingReviews = (id: string) =>
  api.get<BookingReview[]>(`/bookings/${id}/reviews`).then((r) => r.data);

export const submitBookingReview = (
  id: string,
  rating: number,
  comment?: string,
) =>
  api
    .post<BookingReview[]>(`/bookings/${id}/reviews`, {
      rating,
      comment,
    })
    .then((r) => r.data);

export const getBookingDisputes = (bookingId: string) =>
  api.get<BookingDispute[]>(`/disputes/booking/${bookingId}`).then((r) => r.data);

export const getBookingDocuments = (bookingId: string) =>
  api
    .get<BookingDocument[]>(`/bookings/${bookingId}/documents`)
    .then((r) => r.data);

export const generateBookingDocuments = (bookingId: string) =>
  api
    .post<BookingDocument[]>(`/bookings/${bookingId}/documents/generate`)
    .then((r) => r.data);

export const downloadBookingDocument = (
  bookingId: string,
  documentId: string,
) =>
  api
    .get<Blob>(`/bookings/${bookingId}/documents/${documentId}/download`, {
      responseType: 'blob',
    })
    .then((r) => r.data);

export const openBookingDispute = (bookingId: string, reason: string) =>
  api
    .post<BookingDispute>(`/disputes/booking/${bookingId}`, { reason })
    .then((r) => r.data);

export const addBookingDisputeEvidence = (
  disputeId: string,
  payload: FormData | { fileUrl: string; note?: string },
) => {
  if (payload instanceof FormData) {
    return api
      .post<BookingDispute>(`/disputes/${disputeId}/evidence`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  }

  return api
    .post<BookingDispute>(`/disputes/${disputeId}/evidence`, payload)
    .then((r) => r.data);
};

export const getBookingCancellationPreview = (id: string) =>
  api
    .get<BookingCancellationPreview>(`/bookings/${id}/cancellation-preview`)
    .then((r) => r.data);
export const updateBookingStatus = (id: string, status: BookingStatus) =>
  api.patch<Booking>(`/bookings/${id}/status`, { status }).then(r => r.data);

export type BookingChatTokenResponse = {
  rcUserId: string;
  authToken: string;
  roomName: string;
  rocketchatUrl: string;
  isAdminView: boolean;
};

export const getBookingChatToken = (bookingId: string) =>
  api
    .get<BookingChatTokenResponse>(`/bookings/${bookingId}/chat-token`)
    .then((r) => r.data);
