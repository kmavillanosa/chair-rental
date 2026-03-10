import api from './axios';
import type { ItemType, ProductBrand, InventoryItem } from '../types';

export const getItemTypes = () => api.get<ItemType[]>('/item-types').then(r => r.data);
export const createItemType = (data: FormData) => api.post<ItemType>('/item-types', data).then(r => r.data);
export const updateItemType = (id: string, data: Partial<ItemType>) => api.patch<ItemType>(`/item-types/${id}`, data).then(r => r.data);
export const deleteItemType = (id: string) => api.delete(`/item-types/${id}`);

export const getBrands = (itemTypeId?: string) =>
  api.get<ProductBrand[]>('/brands', { params: itemTypeId ? { itemTypeId } : {} }).then(r => r.data);
export const createBrand = (data: Partial<ProductBrand>) => api.post<ProductBrand>('/brands', data).then(r => r.data);
export const updateBrand = (id: string, data: Partial<ProductBrand>) => api.patch<ProductBrand>(`/brands/${id}`, data).then(r => r.data);
export const deleteBrand = (id: string) => api.delete(`/brands/${id}`);

export const getInventory = (vendorId: string) => api.get<InventoryItem[]>(`/inventory/vendor/${vendorId}`).then(r => r.data);
export const createInventoryItem = (data: Partial<InventoryItem>) => api.post<InventoryItem>('/inventory', data).then(r => r.data);
export const updateInventoryItem = (id: string, data: Partial<InventoryItem>) => api.patch<InventoryItem>(`/inventory/${id}`, data).then(r => r.data);
export const deleteInventoryItem = (id: string) => api.delete(`/inventory/${id}`);
