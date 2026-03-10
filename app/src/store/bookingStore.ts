import { create } from 'zustand';
import type { InventoryItem } from '../types';

interface BookingCartItem {
  item: InventoryItem;
  quantity: number;
}

interface BookingState {
  step: number;
  vendorId: string;
  cartItems: BookingCartItem[];
  startDate: string;
  endDate: string;
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  notes: string;
  setStep: (s: number) => void;
  setVendorId: (id: string) => void;
  setCartItems: (items: BookingCartItem[]) => void;
  setDates: (start: string, end: string) => void;
  setDelivery: (addr: string, lat?: number, lng?: number) => void;
  setNotes: (n: string) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  step: 1,
  vendorId: '',
  cartItems: [],
  startDate: '',
  endDate: '',
  deliveryAddress: '',
  notes: '',
  setStep: (step) => set({ step }),
  setVendorId: (vendorId) => set({ vendorId }),
  setCartItems: (cartItems) => set({ cartItems }),
  setDates: (startDate, endDate) => set({ startDate, endDate }),
  setDelivery: (deliveryAddress, deliveryLatitude, deliveryLongitude) =>
    set({ deliveryAddress, deliveryLatitude, deliveryLongitude }),
  setNotes: (notes) => set({ notes }),
  reset: () => set({ step: 1, vendorId: '', cartItems: [], startDate: '', endDate: '', deliveryAddress: '', notes: '' }),
}));
