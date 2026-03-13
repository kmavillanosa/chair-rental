import api from './axios';
import type { Vendor } from '../types';

export interface NearbyVendorFilters {
  radius?: number;
  itemTypeIds?: string[];
  helpersNeeded?: number;
}

export const getNearbyVendors = (
  lat: number,
  lng: number,
  filters: NearbyVendorFilters = {},
) => {
  const params = {
    lat,
    lng,
    radius: filters.radius ?? 50,
    itemTypeIds: filters.itemTypeIds?.join(',') || undefined,
    helpersNeeded: filters.helpersNeeded ?? 0,
  };
  return api.get<Vendor[]>('/vendors/nearby', { params }).then(r => r.data);
};

export const getVendorBySlug = (slug: string) =>
  api.get<Vendor>(`/vendors/slug/${slug}`).then(r => r.data);

export const getAllVendors = () =>
  api.get<Vendor[]>('/vendors').then(r => r.data);

export const getMyVendor = () =>
  api.get<Vendor>('/vendors/my').then(r => r.data);

export const updateMyVendor = (data: Partial<Vendor>) =>
  api.patch<Vendor>('/vendors/my', data).then(r => r.data);

export const verifyVendor = (id: string, isVerified: boolean) =>
  api.patch(`/vendors/${id}/verify`, { isVerified }).then(r => r.data);

export const warnVendor = (id: string) =>
  api.patch(`/vendors/${id}/warn`).then(r => r.data);

export const setVendorActive = (id: string, isActive: boolean) =>
  api.patch(`/vendors/${id}/active`, { isActive }).then(r => r.data);

export const createVendor = (data: Partial<Vendor>) =>
  api.post<Vendor>('/vendors', data).then(r => r.data);

export const submitVendorRegistration = (data: Partial<Vendor>) =>
  api.post<Vendor>('/vendors/register', data).then(r => r.data);

export const getVendorRequests = (status = 'pending') =>
  api.get<Vendor[]>('/vendors/requests', { params: { status } }).then(r => r.data);

export const reviewVendorRegistration = (
  id: string,
  decision: 'approve' | 'reject',
  notes?: string,
) => api.patch<Vendor>(`/vendors/${id}/review`, { decision, notes }).then(r => r.data);

export const getVendorKycSubmission = (id: string) =>
  api.get<Vendor>(`/vendors/${id}/kyc`).then((r) => r.data);

export const getVendorDocuments = (id: string) =>
  api.get(`/vendors/${id}/documents`).then((r) => r.data);

export const listVendorVerificationItems = (id: string) =>
  api.get(`/vendors/${id}/items`).then((r) => r.data);

export const flagVendorSuspicious = (
  id: string,
  flagged = true,
  reason?: string,
) => api.patch<Vendor>(`/vendors/${id}/flag-suspicious`, { flagged, reason }).then((r) => r.data);

export const suspendVendor = (
  id: string,
  reason: string,
  suspendedUntil?: string,
) => api.patch<Vendor>(`/vendors/${id}/suspend`, { reason, suspendedUntil }).then((r) => r.data);
