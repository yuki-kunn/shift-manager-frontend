export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}
export function calcMonthlySalary(hours: number, wage: number): number {
  return Math.round(hours * wage);
}
export const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  contract: '契約社員', intern: 'インターン', part: 'パート',
};
export const EMPLOYEE_TYPE_COLORS: Record<string, string> = {
  contract: 'bg-blue-100 text-blue-800',
  intern: 'bg-green-100 text-green-800',
  part: 'bg-orange-100 text-orange-800',
};
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
export function getDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
