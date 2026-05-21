import { writable } from 'svelte/store';
import type { Employee, BusinessHours, Schedule } from './api.js';

function persistedWritable<T>(key: string, initial: T) {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const store = writable<T>(stored !== null ? JSON.parse(stored) : initial);
  store.subscribe(v => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(v));
  });
  return store;
}

export interface AuthState {
  token: string;
  role: 'admin' | 'facility';
  facilityId?: string;
  facilityName?: string;
}

export const auth = persistedWritable<AuthState | null>('auth', null);

export function logout() {
  auth.set(null);
}

export const employees = writable<Employee[]>([]);
export const businessHours = writable<BusinessHours | null>(null);
export const currentSchedule = writable<Schedule | null>(null);
export const toast = writable<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

const now = new Date();
export const selectedYear = persistedWritable('selectedYear', now.getFullYear());
export const selectedMonth = persistedWritable('selectedMonth', now.getMonth() + 1);

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toast.set({ message, type });
  setTimeout(() => toast.set(null), 3000);
}
