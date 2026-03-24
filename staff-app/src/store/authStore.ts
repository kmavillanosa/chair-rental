import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  adminToken: string | null;
  adminUser: User | null;
  login: (token: string, user: User) => void;
  startImpersonation: (token: string, user: User) => void;
  stopImpersonation: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      adminToken: null,
      adminUser: null,
      login: (token, user) => set({ token, user }),
      startImpersonation: (token, user) =>
        set((state) => {
          const hasAdminBackup = Boolean(state.adminToken && state.adminUser);
          const shouldCreateBackup =
            !hasAdminBackup && state.user?.role === 'admin' && Boolean(state.token);
          const adminUserId = shouldCreateBackup
            ? state.user?.id
            : state.adminUser?.id;
          const adminRole = shouldCreateBackup
            ? state.user?.role
            : state.adminUser?.role;

          return {
            token,
            user: {
              ...user,
              impersonation: {
                active: true,
                impersonatedByUserId: adminUserId,
                impersonatedByRole: adminRole,
              },
            },
            adminToken: shouldCreateBackup ? state.token : state.adminToken,
            adminUser: shouldCreateBackup ? state.user : state.adminUser,
          };
        }),
      stopImpersonation: () =>
        set((state) => {
          if (!state.adminToken || !state.adminUser) {
            return state;
          }

          return {
            token: state.adminToken,
            user: state.adminUser,
            adminToken: null,
            adminUser: null,
          };
        }),
      logout: () => set({ token: null, user: null, adminToken: null, adminUser: null }),
    }),
    { name: 'auth' }
  )
);
