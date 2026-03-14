import api from './axios';
import type { Vendor, VendorDocument } from '../types';
import { resolveMediaUrl } from '../utils/media';

const mapVendorDocument = (document: VendorDocument): VendorDocument => ({
  ...document,
  fileUrl: resolveMediaUrl(document.fileUrl),
});

const mapVendor = (vendor: Vendor): Vendor => ({
  ...vendor,
  logoUrl: resolveMediaUrl(vendor.logoUrl),
  kycDocumentUrl: resolveMediaUrl(vendor.kycDocumentUrl),
  user: vendor.user
    ? {
        ...vendor.user,
        avatar: resolveMediaUrl(vendor.user.avatar),
      }
    : vendor.user,
  documents: vendor.documents?.map(mapVendorDocument),
});

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
  return api.get<Vendor[]>('/vendors/nearby', { params }).then(r => r.data.map(mapVendor));
};

export const getVendorBySlug = (slug: string) =>
  api.get<Vendor>(`/vendors/slug/${slug}`).then(r => mapVendor(r.data));

export const getAllVendors = () =>
  api.get<Vendor[]>('/vendors').then(r => r.data.map(mapVendor));

export const getMyVendor = () =>
  api.get<Vendor>('/vendors/my').then(r => mapVendor(r.data));

export const updateMyVendor = (data: Partial<Vendor>) =>
  api.patch<Vendor>('/vendors/my', data).then(r => mapVendor(r.data));

export const verifyVendor = (id: string, isVerified: boolean) =>
  api.patch<Vendor>(`/vendors/${id}/verify`, { isVerified }).then(r => mapVendor(r.data));

export const provisionVendorMerchantId = (id: string) =>
  api.patch<Vendor>(`/vendors/${id}/provision-merchant`).then(r => mapVendor(r.data));

export const warnVendor = (id: string) =>
  api.patch<Vendor>(`/vendors/${id}/warn`).then(r => mapVendor(r.data));

export const clearVendorWarnings = (id: string) =>
  api.patch<Vendor>(`/vendors/${id}/warnings/reset`).then((r) => mapVendor(r.data));

export const setVendorActive = (id: string, isActive: boolean) =>
  api.patch<Vendor>(`/vendors/${id}/active`, { isActive }).then(r => mapVendor(r.data));

export const createVendor = (data: CreateVendorPayload) =>
  api.post<Vendor>('/vendors', data).then(r => mapVendor(r.data));

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
    formData.append(key, String(value));
  }

  return api
    .post<Vendor>('/vendors/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => mapVendor(r.data));
};

export const requestVendorEmailOtp = (email: string, deviceFingerprint?: string) =>
  api.post('/vendors/otp/request', { email, deviceFingerprint }).then((r) => r.data);

export const verifyVendorEmailOtp = (email: string, code: string) =>
  api.post('/vendors/otp/verify', { email, code }).then((r) => r.data);

// Backward-compatible aliases for older call sites.
export const requestVendorPhoneOtp = requestVendorEmailOtp;
export const verifyVendorPhoneOtp = verifyVendorEmailOtp;

export const getMyVendorKycSubmission = () =>
  api.get<Vendor>('/vendors/my/kyc').then((r) => mapVendor(r.data));

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

export const getVendorRequests = (status = 'pending') =>
  api.get<Vendor[]>('/vendors/requests', { params: { status } }).then(r => r.data.map(mapVendor));

export const reviewVendorRegistration = (
  id: string,
  decision: 'approve' | 'reject',
  notes?: string,
) => api.patch<Vendor>(`/vendors/${id}/review`, { decision, notes }).then(r => mapVendor(r.data));

export const getVendorKycSubmission = (id: string) =>
  api.get<Vendor>(`/vendors/${id}/kyc`).then((r) => mapVendor(r.data));

export const getVendorDocuments = (id: string) =>
  api.get(`/vendors/${id}/documents`).then((r) => r.data);

export const listVendorVerificationItems = (id: string) =>
  api.get(`/vendors/${id}/items`).then((r) => r.data);

export const flagVendorSuspicious = (
  id: string,
  flagged = true,
  reason?: string,
) => api.patch<Vendor>(`/vendors/${id}/flag-suspicious`, { flagged, reason }).then((r) => mapVendor(r.data));

export const suspendVendor = (
  id: string,
  reason: string,
  suspendedUntil?: string,
) => api.patch<Vendor>(`/vendors/${id}/suspend`, { reason, suspendedUntil }).then((r) => mapVendor(r.data));
