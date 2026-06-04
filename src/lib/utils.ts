export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}
export function calcMonthlySalary(hours: number, wage: number): number {
  return Math.round(hours * wage);
}
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
export function getDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Smaregi タイムカード CSV エクスポート用フォーマット
 * 形式: yyyy/mm/dd hh:nn
 */
function formatSmaregiDateTime(date: string, time: string): string {
  // date: "YYYY-MM-DD", time: "HH:MM"
  const [year, month, day] = date.split('-');
  return `${year}/${month}/${day} ${time}`;
}

/**
 * 時刻文字列 "HH:MM" に指定分を加算して返す
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export interface CsvRow {
  employeeId: string;
  facilityId: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
}

/**
 * Smaregi タイムカード形式の CSV 文字列を生成する。
 *
 * ルール:
 * - 7時間以上のシフト → 勤務開始から3時間後に休憩1開始（1時間）
 * - 各時刻は "yyyy/mm/dd hh:nn" 形式
 * - 区切り文字はカンマ、文字コードは UTF-8 (BOM付き)
 */
export function generateSmaregiCsv(rows: CsvRow[]): string {
  const BOM = '﻿';
  const header = '従業員ID,事業所ID,出勤時間,退勤時間,休憩1開始時間,休憩1終了時間,休憩2開始時間,休憩2終了時間';

  const lines = rows.map(row => {
    const clockIn  = formatSmaregiDateTime(row.date, row.startTime);
    const clockOut = formatSmaregiDateTime(row.date, row.endTime);

    let breakStart = '';
    let breakEnd   = '';

    const hours = calcHours(row.startTime, row.endTime);
    if (hours >= 7) {
      // 出勤3時間後を休憩開始とする（よくある運用）
      const bStart = addMinutesToTime(row.startTime, 180);
      const bEnd   = addMinutesToTime(bStart, 60);
      breakStart = formatSmaregiDateTime(row.date, bStart);
      breakEnd   = formatSmaregiDateTime(row.date, bEnd);
    }

    return [
      row.employeeId,
      row.facilityId,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      '', // 休憩2開始時間（未使用）
      '', // 休憩2終了時間（未使用）
    ].join(',');
  });

  return BOM + [header, ...lines].join('\r\n');
}
