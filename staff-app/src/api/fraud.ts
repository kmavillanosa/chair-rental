import api from './axios';
import type {
  FraudAlert,
  FraudAlertStatus,
  FraudAlertType,
} from '../types';

export type FraudSummary = {
  total: number;
  open: number;
  underReview: number;
  highPriority: number;
};

export const getFraudSummary = () =>
  api.get<FraudSummary>('/fraud/summary').then((response) => response.data);

export const getFraudAlerts = (filters?: {
  status?: FraudAlertStatus;
  type?: FraudAlertType;
}) =>
  api
    .get<FraudAlert[]>('/fraud/alerts', {
      params: filters,
    })
    .then((response) => response.data);

export const reviewFraudAlert = (
  id: string,
  status: FraudAlertStatus,
  resolutionNote?: string,
) =>
  api
    .patch<FraudAlert>(`/fraud/alerts/${id}/review`, {
      status,
      resolutionNote,
    })
    .then((response) => response.data);
