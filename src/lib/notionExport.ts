import type { Schedule, ScheduleSlot, Employee } from './api.js';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '') + '/api';

// テスト用DBのID（シフト管理ページ配下の「シフトテスト」データベース）
const TEST_DB_ID = 'fe0a4a08c38246e6aa7ee55b443e5ad9';

function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('auth');
  if (!raw) return null;
  try { return JSON.parse(raw)?.token ?? null; } catch { return null; }
}

async function notionPost(path: string, body: object) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`API error: ${res.status} ${JSON.stringify(err)}`);
  }
  return res.json();
}

function calcBillableHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  return h >= 7 ? h - 1 : h;
}

export async function exportScheduleToNotion(
  schedule: Schedule,
  employees: Employee[],
  year: number,
  month: number,
): Promise<string> {
  const empMap = new Map<string, Employee>(employees.map(e => [e.id, e]));

  // 1スロット = 1エントリとしてDBに登録
  for (const slot of schedule.slots) {
    const emp = empMap.get(slot.employeeId);
    if (!emp) continue;

    const billable = calcBillableHours(slot.startTime, slot.endTime);
    const timeRange = `${slot.startTime}〜${slot.endTime}`;

    await notionPost('/notion/pages', {
      parent: { database_id: TEST_DB_ID },
      properties: {
        名前: {
          title: [{ type: 'text', text: { content: emp.name } }],
        },
        日付: {
          date: { start: slot.date },
        },
        時間帯: {
          rich_text: [{ type: 'text', text: { content: timeRange } }],
        },
        '勤務時間(h)': {
          number: billable,
        },
        備考: {
          rich_text: [{ type: 'text', text: { content: slot.note ?? '' } }],
        },
      },
    });
  }

  return `https://www.notion.so/${TEST_DB_ID.replace(/-/g, '')}`;
}
