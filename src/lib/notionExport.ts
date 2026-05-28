import type { Schedule, ScheduleSlot, Employee } from './api.js';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '') + '/api';

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
  // データベースID（sampleデータベース）
  const DATABASE_ID = '36e5c64f-bdc0-80c0-91d7-000b384025d8';

  const empMap = new Map<string, Employee>(employees.map(e => [e.id, e]));

  // 1スロット = 1エントリとしてデータベースに登録
  for (const slot of schedule.slots) {
    const emp = empMap.get(slot.employeeId);
    if (!emp) continue;

    const billable = calcBillableHours(slot.startTime, slot.endTime);
    const timeRange = `${slot.startTime}〜${slot.endTime}（${billable.toFixed(1)}h）`;
    const noteText = slot.note ? `　※${slot.note}` : '';
    const title = `${emp.name}　${timeRange}${noteText}`;

    // 日付をISO形式で（YYYY-MM-DD）
    const dateStr = slot.date; // すでにYYYY-MM-DD形式

    await notionPost('/notion/pages', {
      parent: { database_id: DATABASE_ID },
      properties: {
        Name: {
          title: [{ type: 'text', text: { content: title } }],
        },
        Date: {
          date: { start: dateStr },
        },
        Tags: {
          multi_select: [{ name: emp.type ?? 'その他' }],
        },
      },
    });
  }

  // 転記先ページのURLを返す
  return 'https://app.notion.com/p/931691cd32714dd28c92c75c11a2a39d';
}
