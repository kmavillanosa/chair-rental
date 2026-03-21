import api from './axios';
import type { VendorPayment, DeliveryRate, VendorPricingConfig } from '../types';

export const getAllPayments = () => api.get<VendorPayment[]>('/payments').then(r => r.data);
export const getMyPayments = () => api.get<VendorPayment[]>('/payments/vendor/my').then(r => r.data);
export const markPaid = (id: string, transactionRef?: string) =>
  api.patch<VendorPayment>(`/payments/${id}/paid`, { transactionRef }).then(r => r.data);
export const markOverdue = (id: string) => api.patch<VendorPayment>(`/payments/${id}/overdue`).then(r => r.data);
export const createPayment = (data: object) => api.post<VendorPayment>('/payments', data).then(r => r.data);

export const getDeliveryRates = () => api.get<DeliveryRate[]>('/payments/delivery-rates').then(r => r.data);
export const getVendorDeliveryRates = (vendorId: string) =>
  api.get<DeliveryRate[]>(`/payments/delivery-rates/vendor/${vendorId}`).then((r) => r.data);
export const addDeliveryRate = (data: object) => api.post<DeliveryRate>('/payments/delivery-rates', data).then(r => r.data);
export const updateDeliveryRate = (id: string, data: object) =>
  api.patch<DeliveryRate>(`/payments/delivery-rates/${id}`, data).then(r => r.data);
export const deleteDeliveryRate = (id: string) => api.delete(`/payments/delivery-rates/${id}`);

export const getMyPricingConfig = () =>
  api
    .get<VendorPricingConfig>('/payments/vendors/my/pricing-config')
    .then((r) => r.data);

export const updateMyPricingConfig = (data: object) =>
  api
    .patch<VendorPricingConfig>('/payments/vendors/my/pricing-config', data)
    .then((r) => r.data);
