import api from './axios';
import type { AdminPackageTemplate, VendorPackage } from '../types';

export type UpsertAdminPackageTemplatePayload = {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  items: Array<{
    itemTypeId: string;
    requiredQty: number;
    suggestedUnitPrice?: number | null;
  }>;
};

export const getAdminPackageTemplates = (includeInactive = true) =>
  api
    .get<AdminPackageTemplate[]>('/packages/admin/templates', {
      params: { includeInactive: includeInactive ? '1' : '0' },
    })
    .then((r) => r.data);

export const createAdminPackageTemplate = (payload: UpsertAdminPackageTemplatePayload) =>
  api.post<AdminPackageTemplate>('/packages/admin/templates', payload).then((r) => r.data);

export const updateAdminPackageTemplate = (
  id: string,
  payload: UpsertAdminPackageTemplatePayload,
) => api.patch<AdminPackageTemplate>(`/packages/admin/templates/${id}`, payload).then((r) => r.data);

export const deleteAdminPackageTemplate = (id: string) =>
  api.delete<{ id: string; removed: boolean }>(`/packages/admin/templates/${id}`).then((r) => r.data);

export const getMyVendorPackages = (includeInactive = true) =>
  api
    .get<VendorPackage[]>('/packages/vendor/me', {
      params: { includeInactive: includeInactive ? '1' : '0' },
    })
    .then((r) => r.data);

export const updateMyVendorPackageActive = (id: string, isActive: boolean) =>
  api
    .patch<VendorPackage>(`/packages/vendor/me/${id}/active`, { isActive })
    .then((r) => r.data);

export const getPublicVendorPackages = (vendorId: string) =>
  api.get<VendorPackage[]>(`/packages/vendor/${vendorId}/public`).then((r) => r.data);