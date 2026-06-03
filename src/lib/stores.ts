import { writable, derived } from 'svelte/store';
import type { Employee, BusinessHours, EmployeeType } from './api.js';

function persistedWritable<T>(key: string, initial: T) {
  let parsed: T = initial;
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try { parsed = JSON.parse(raw); } catch { /* 破損データは無視して初期値を使用 */ }
    }
  }
  const store = writable<T>(parsed);
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
export const employeeTypes = writable<EmployeeType[]>([]);
/** 従業員種別名 → EmployeeType の Map。linear search の代わりに各ページで利用する */
export const employeeTypeMap = derived(employeeTypes, $types =>
  new Map<string, EmployeeType>($types.map(t => [t.name, t]))
);
export const toast = writable<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

const now = new Date();
export const selectedYear = persistedWritable('selectedYear', now.getFullYear());
export const selectedMonth = persistedWritable('selectedMonth', now.getMonth() + 1);

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toast.set({ message, type });
  setTimeout(() => toast.set(null), 3000);
}
