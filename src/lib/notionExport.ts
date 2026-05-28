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

export async function exportScheduleToNotion(
  schedule: Schedule,
  employees: Employee[],
  year: number,
  month: number,
): Promise<string> {
  const rawParentId = import.meta.env.VITE_NOTION_PARENT_PAGE_ID as string;
  if (!rawParentId) throw new Error('VITE_NOTION_PARENT_PAGE_ID が設定されていません');
  // URLやクエリパラメータが含まれている場合はUUIDだけ抽出してハイフン付きに正規化
  const uuidMatch = rawParentId.replace(/-/g, '').match(/[0-9a-f]{32}/i);
  if (!uuidMatch) throw new Error('VITE_NOTION_PARENT_PAGE_ID が正しくありません');
  const raw = uuidMatch[0];
  const parentPageId = `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;

  const empMap = new Map<string, Employee>(employees.map(e => [e.id, e]));

  const byDate = new Map<string, ScheduleSlot[]>();
  for (const slot of schedule.slots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date)!.push(slot);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  const blocks: object[] = [];
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  for (const date of sortedDates) {
    const slots = byDate.get(date)!.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const d = new Date(date);
    const dow = dayNames[d.getDay()];
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}（${dow}）`;

    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: { rich_text: [{ type: 'text', text: { content: dateLabel } }] },
    });

    for (const slot of slots) {
      const emp = empMap.get(slot.employeeId);
      if (!emp) continue;
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      const noteText = slot.note ? `  ※${slot.note}` : '';
      const content = `${emp.name}　${slot.startTime} 〜 ${slot.endTime}（${hours.toFixed(1)}h）${noteText}`;
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content } }] },
      });
    }
  }

  const pageTitle = `${year}年${month}月 シフト表`;
  const res = await notionPost('/notion/pages', {
    parent: { page_id: parentPageId },
    properties: {
      title: [{ type: 'text', text: { content: pageTitle } }],
    },
    children: blocks,
  });

  return res.url as string;
}
