const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '') + '/api';

function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('auth');
  if (!raw) return null;
  try { return JSON.parse(raw)?.token ?? null; } catch { return null; }
}

export interface EmployeeType {
  id: string;
  facilityId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}
export type EmployeePriority = 'high' | 'medium' | 'low';

export interface Employee {
  id: string; name: string; type: string;
  hourlyWage: number; color: string;
  priority: EmployeePriority;
  createdAt: string; updatedAt: string;
}
export interface BusinessHours {
  id: string; openTime: string; closeTime: string; longShiftThreshold: number; minStaff: number; maxStaff: number;
}
export interface ShiftRequest {
  id: string; employeeId: string; year: number; month: number; day: number;
  startTime: string | null; endTime: string | null; isAvailable: boolean; note: string | null;
}
export interface ScheduleSlot {
  id: string; scheduleId: string; employeeId: string; date: string;
  startTime: string; endTime: string; note: string | null;
}
export interface Schedule {
  id: string; year: number; month: number; status: 'draft' | 'published'; slots: ScheduleSlot[];
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + url, { headers, ...options });
  if (res.status === 401) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('auth');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export const authApi = {
  adminLogin: (username: string, password: string) =>
    fetch(BASE + '/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e))),
  facilityLogin: (username: string, password: string) =>
    fetch(BASE + '/auth/facility/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e))),
};

export const adminApi = {
  listFacilities: () => fetchJson<{ id: string; name: string; username: string; createdAt: string }[]>('/admin/facilities'),
  createFacility: (data: { name: string; username: string; password: string }) =>
    fetchJson<{ id: string; name: string; username: string }>('/admin/facilities', { method: 'POST', body: JSON.stringify(data) }),
  deleteFacility: (id: string) =>
    fetchJson<{ success: boolean }>(`/admin/facilities/${id}`, { method: 'DELETE' }),
  changePassword: (id: string, password: string) =>
    fetchJson<{ success: boolean }>(`/admin/facilities/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
};

export const api = {
  employees: {
    list: () => fetchJson<Employee[]>('/employees'),
    create: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) =>
      fetchJson<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Employee>) =>
      fetchJson<Employee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>(`/employees/${id}`, { method: 'DELETE' }),
  },
  settings: {
    getBusinessHours: () => fetchJson<BusinessHours>('/settings/business-hours'),
    updateBusinessHours: (data: Partial<BusinessHours>) =>
      fetchJson<BusinessHours>('/settings/business-hours', { method: 'PUT', body: JSON.stringify(data) }),
    listEmployeeTypes: () => fetchJson<EmployeeType[]>('/settings/employee-types'),
    createEmployeeType: (data: { name: string; color: string }) =>
      fetchJson<EmployeeType>('/settings/employee-types', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployeeType: (id: string, data: { name: string; color: string }) =>
      fetchJson<EmployeeType>(`/settings/employee-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployeeType: (id: string) =>
      fetchJson<{ success: boolean }>(`/settings/employee-types/${id}`, { method: 'DELETE' }),
  },
  shiftRequests: {
    list: (employeeId: string, year: number, month: number) =>
      fetchJson<ShiftRequest[]>(`/shift-requests?employeeId=${employeeId}&year=${year}&month=${month}`),
    listByMonth: (year: number, month: number) =>
      fetchJson<ShiftRequest[]>(`/shift-requests?year=${year}&month=${month}`),
    bulkUpsert: (data: Omit<ShiftRequest, 'id'>[]) =>
      fetchJson<ShiftRequest[]>('/shift-requests/bulk', { method: 'POST', body: JSON.stringify(data) }),
  },
  schedules: {
    list: (year: number, month: number) =>
      fetchJson<Schedule[]>(`/schedules?year=${year}&month=${month}`),
    addSlot: (scheduleId: string, data: Omit<ScheduleSlot, 'id' | 'scheduleId'>) =>
      fetchJson<ScheduleSlot>(`/schedules/${scheduleId}/slots`, { method: 'POST', body: JSON.stringify(data) }),
    updateSlot: (scheduleId: string, slotId: string, data: Partial<ScheduleSlot>) =>
      fetchJson<ScheduleSlot>(`/schedules/${scheduleId}/slots/${slotId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSlot: (scheduleId: string, slotId: string) =>
      fetchJson<{ success: boolean }>(`/schedules/${scheduleId}/slots/${slotId}`, { method: 'DELETE' }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>(`/schedules/${id}`, { method: 'DELETE' }),
  },
  ai: {
    generateSchedule: (year: number, month: number, note?: string) =>
      fetchJson<Schedule>('/ai/generate-schedule', { method: 'POST', body: JSON.stringify({ year, month, note }) }),
  },
};
