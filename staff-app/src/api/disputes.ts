import api from './axios';
import type {
  BookingDispute,
  BookingDisputeOutcome,
  BookingDisputeStatus,
} from '../types';

export const getAdminDisputes = (status?: BookingDisputeStatus) =>
  api
    .get<BookingDispute[]>('/disputes/admin', {
      params: status ? { status } : undefined,
    })
    .then((response) => response.data);

export const reviewDispute = (
  disputeId: string,
  payload: {
    outcome: BookingDisputeOutcome;
    resolutionNote?: string;
    refundAmount?: number;
  },
) =>
  api
    .patch<BookingDispute>(`/disputes/${disputeId}/review`, payload)
    .then((response) => response.data);
