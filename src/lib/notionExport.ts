import type { Schedule, Employee } from './api.js';
import { BASE, getToken } from './api.js';

// Notion データベース ID は施設設定（facilitySettings.notionDatabaseId）から受け取る

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
  databaseId: string,
): Promise<string> {
  const empMap = new Map<string, Employee>(employees.map(e => [e.id, e]));

  // 1スロット = 1エントリとしてDBに登録
  for (const slot of schedule.slots) {
    const emp = empMap.get(slot.employeeId);
    if (!emp) continue;

    const billable = calcBillableHours(slot.startTime, slot.endTime);
    const timeRange = `${slot.startTime}〜${slot.endTime}`;

    await notionPost('/notion/pages', {
      parent: { database_id: databaseId },
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

  return `https://www.notion.so/${databaseId.replace(/-/g, '')}`;
}
