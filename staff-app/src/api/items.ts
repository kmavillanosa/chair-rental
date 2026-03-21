import api from './axios';
import type { ItemType, ProductBrand, InventoryItem } from '../types';
import { resolveMediaUrl } from '../utils/media';

const mapItemType = (itemType: ItemType): ItemType => ({
  ...itemType,
  pictureUrl: resolveMediaUrl(itemType.pictureUrl),
});

const mapInventoryItem = (item: InventoryItem): InventoryItem => ({
  ...item,
  pictureUrl: resolveMediaUrl(item.pictureUrl),
  galleryPhotos: (item.galleryPhotos || [])
    .map((photoUrl) => resolveMediaUrl(photoUrl))
    .filter(Boolean),
  itemType: item.itemType ? mapItemType(item.itemType) : item.itemType,
});

export const getItemTypes = () => api.get<ItemType[]>('/item-types').then(r => r.data.map(mapItemType));
export const getAdminItemTypes = () => api.get<ItemType[]>('/item-types/admin/all').then(r => r.data.map(mapItemType));
export const createItemType = (data: FormData) => api.post<ItemType>('/item-types', data).then(r => mapItemType(r.data));
export const updateItemType = (id: string, data: FormData | Partial<ItemType>) =>
  api.patch<ItemType>(`/item-types/${id}`, data).then(r => mapItemType(r.data));
export const deleteItemType = (id: string) => api.delete(`/item-types/${id}`);

export const getBrands = (itemTypeId?: string) =>
  api.get<ProductBrand[]>('/brands', { params: itemTypeId ? { itemTypeId } : {} }).then(r => r.data);
export const createBrand = (data: Partial<ProductBrand>) => api.post<ProductBrand>('/brands', data).then(r => r.data);
export const updateBrand = (id: string, data: Partial<ProductBrand>) => api.patch<ProductBrand>(`/brands/${id}`, data).then(r => r.data);
export const deleteBrand = (id: string) => api.delete(`/brands/${id}`);

export const getInventory = (vendorId: string) => api.get<InventoryItem[]>(`/inventory/vendor/${vendorId}`).then(r => r.data.map(mapInventoryItem));
export const createInventoryItem = (data: Partial<InventoryItem>) => api.post<InventoryItem>('/inventory', data).then(r => mapInventoryItem(r.data));
export const updateInventoryItem = (id: string, data: Partial<InventoryItem>) => api.patch<InventoryItem>(`/inventory/${id}`, data).then(r => mapInventoryItem(r.data));
export const deleteInventoryItem = (id: string) => api.delete(`/inventory/${id}`);

// Inventory breakdown: total, reserved, available per item for a vendor (optionally for a date)
export const getInventoryBreakdown = (vendorId: string, date?: string) =>
  api.get(`/inventory/vendor/${vendorId}/breakdown`, { params: date ? { date } : {} }).then(r => r.data);
