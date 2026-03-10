import api from './axios';
import type { Vendor } from '../types';

export const getNearbyVendors = (lat: number, lng: number, radius = 50) =>
  api.get<Vendor[]>('/vendors/nearby', { params: { lat, lng, radius } }).then(r => r.data);

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
