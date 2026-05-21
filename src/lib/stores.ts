import { writable } from 'svelte/store';
import type { Employee, BusinessHours, Schedule } from './api.js';

export const employees = writable<Employee[]>([]);
export const businessHours = writable<BusinessHours | null>(null);
export const currentSchedule = writable<Schedule | null>(null);
export const selectedYear = writable<number>(new Date().getFullYear());
export const selectedMonth = writable<number>(new Date().getMonth() + 1);
export const toast = writable<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toast.set({ message, type });
  setTimeout(() => toast.set(null), 3000);
}
