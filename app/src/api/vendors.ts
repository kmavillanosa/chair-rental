import api from './axios';
import type { Vendor } from '../types';

export type CreateVendorPayload = Partial<Vendor> & {
  userEmail?: string;
};

export interface VendorRegistrationPayload extends Partial<Vendor> {
  deviceFingerprint?: string;
  governmentIdFile?: File | null;
  selfieFile?: File | null;
  mayorsPermitFile?: File | null;
  barangayPermitFile?: File | null;
  logoFile?: File | null;
}

export interface NearbyVendorFilters {
  radius?: number;
  itemTypeIds?: string[];
  helpersNeeded?: number;
  startDate?: string;
  endDate?: string;
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
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  };
  return api.get<Vendor[]>('/vendors/nearby', { params }).then(r => r.data);
};

export const getVendorBySlug = (slug: string) =>
  api.get<Vendor>(`/vendors/slug/${slug}`).then(r => r.data);

export const checkSlugAvailability = (slug: string) =>
  api.get<{ available: boolean; slug: string }>(`/vendors/slug/check`, { params: { slug } }).then(r => r.data);

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

export const setVendorTestAccount = (id: string, isTestAccount: boolean) =>
  api.patch(`/vendors/${id}/test-account`, { isTestAccount }).then(r => r.data);

export const createVendor = (data: CreateVendorPayload) =>
  api.post<Vendor>('/vendors', data).then(r => r.data);

export const submitVendorRegistration = (data: VendorRegistrationPayload) => {
  const formData = new FormData();

  const fileFields: Array<[keyof VendorRegistrationPayload, File | null | undefined]> = [
    ['governmentIdFile', data.governmentIdFile],
    ['selfieFile', data.selfieFile],
    ['mayorsPermitFile', data.mayorsPermitFile],
    ['barangayPermitFile', data.barangayPermitFile],
    ['logoFile', data.logoFile],
  ];

  for (const [field, file] of fileFields) {
    if (file) {
      formData.append(field, file);
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (
      value === undefined ||
      value === null ||
      key.endsWith('File')
    ) {
      continue;
    }

    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
      continue;
    }

    formData.append(key, String(value));
  }

  return api
    .post<Vendor>('/vendors/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const requestVendorEmailOtp = (email: string, deviceFingerprint?: string) =>
  api.post('/vendors/otp/request', { email, deviceFingerprint }).then((r) => r.data);

export const verifyVendorEmailOtp = (email: string, code: string) =>
  api.post('/vendors/otp/verify', { email, code }).then((r) => r.data);

// Backward-compatible aliases for older call sites.
export const requestVendorPhoneOtp = requestVendorEmailOtp;
export const verifyVendorPhoneOtp = verifyVendorEmailOtp;

export const getMyVendorKycSubmission = () =>
  api.get<Vendor>('/vendors/my/kyc').then((r) => r.data);

export const uploadMyVendorDocument = (
  documentType: string,
  file: File,
  metadata?: Record<string, unknown>,
) => {
  const formData = new FormData();
  formData.append('documentType', documentType);
  formData.append('file', file);
  if (metadata) formData.append('metadata', JSON.stringify(metadata));

  return api
    .post('/vendors/my/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};
