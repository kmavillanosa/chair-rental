import { create } from 'zustand';
import type { Vendor, VendorPayment } from '../types';

interface AdminState {
  vendors: Vendor[];
  payments: VendorPayment[];
  setVendors: (v: Vendor[]) => void;
  setPayments: (p: VendorPayment[]) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  vendors: [],
  payments: [],
  setVendors: (vendors) => set({ vendors }),
  setPayments: (payments) => set({ payments }),
}));
