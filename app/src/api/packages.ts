import api from './axios';
import type { PublicVendorPackage } from '../types';

export const getPublicVendorPackages = (vendorId: string) =>
  api.get<PublicVendorPackage[]>(`/packages/vendor/${vendorId}/public`).then((r) => r.data);
