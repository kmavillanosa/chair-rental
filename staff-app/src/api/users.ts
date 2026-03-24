import api from './axios';
import type { User } from '../types';

export const getCustomers = () =>
  api.get<User[]>('/users/customers').then((r) => r.data);

export const getCustomerById = (id: string) =>
  api.get<User>(`/users/customers/${id}`).then((r) => r.data);

export const setCustomerActive = (id: string, isActive: boolean) =>
  api.patch<User>(`/users/customers/${id}/active`, { isActive }).then((r) => r.data);
