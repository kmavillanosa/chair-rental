import { create } from 'zustand';
import type { Vendor, InventoryItem, Booking } from '../types';

interface VendorState {
  vendor: Vendor | null;
  inventory: InventoryItem[];
  bookings: Booking[];
  setVendor: (v: Vendor) => void;
  setInventory: (items: InventoryItem[]) => void;
  setBookings: (bookings: Booking[]) => void;
}

export const useVendorStore = create<VendorState>((set) => ({
  vendor: null,
  inventory: [],
  bookings: [],
  setVendor: (vendor) => set({ vendor }),
  setInventory: (inventory) => set({ inventory }),
  setBookings: (bookings) => set({ bookings }),
}));
