const BASE = '/api';

export type EmployeeType = 'contract' | 'intern' | 'part';

export interface Employee {
  id: string; name: string; type: EmployeeType;
  hourlyWage: number; color: string;
  createdAt: string; updatedAt: string;
}
export interface BusinessHours {
  id: string; openTime: string; closeTime: string; longShiftThreshold: number;
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
  const res = await fetch(BASE + url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

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
  },
  shiftRequests: {
    list: (employeeId: string, year: number, month: number) =>
      fetchJson<ShiftRequest[]>(`/shift-requests?employeeId=${employeeId}&year=${year}&month=${month}`),
    bulkUpsert: (data: Omit<ShiftRequest, 'id'>[]) =>
      fetchJson<ShiftRequest[]>('/shift-requests/bulk', { method: 'POST', body: JSON.stringify(data) }),
  },
  schedules: {
    list: (year: number, month: number) =>
      fetchJson<Schedule[]>(`/schedules?year=${year}&month=${month}`),
    updateSlot: (scheduleId: string, slotId: string, data: Partial<ScheduleSlot>) =>
      fetchJson<ScheduleSlot>(`/schedules/${scheduleId}/slots/${slotId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>(`/schedules/${id}`, { method: 'DELETE' }),
  },
  ai: {
    generateSchedule: (year: number, month: number) =>
      fetchJson<Schedule>('/ai/generate-schedule', { method: 'POST', body: JSON.stringify({ year, month }) }),
  },
};
