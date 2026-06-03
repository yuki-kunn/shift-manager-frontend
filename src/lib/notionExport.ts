import type { Schedule, Employee } from './api.js';
import { BASE, getToken } from './api.js';

// TODO: 本番環境では環境変数（VITE_NOTION_DB_ID 等）から取得するよう変更すること
const TEST_DB_ID = 'fe0a4a08c38246e6aa7ee55b443e5ad9';

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
