export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}
export function calcMonthlySalary(hours: number, wage: number): number {
  return Math.round(hours * wage);
}
// 後方互換のために残すが非推奨
export const EMPLOYEE_TYPE_LABELS: Record<string, string> = {};
export const EMPLOYEE_TYPE_COLORS: Record<string, string> = {};
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
export function getDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
