import type { Schedule, ScheduleSlot, Employee } from './api.js';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '') + '/api';

function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('auth');
  if (!raw) return null;
  try { return JSON.parse(raw)?.token ?? null; } catch { return null; }
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function notionRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
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

function buildBlocks(
  schedule: Schedule,
  empMap: Map<string, Employee>,
): object[] {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const byDate = new Map<string, ScheduleSlot[]>();

  for (const slot of schedule.slots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date)!.push(slot);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  const blocks: object[] = [];

  for (const date of sortedDates) {
    const slots = byDate.get(date)!.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const d = new Date(date);
    const dow = dayNames[d.getDay()];
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}（${dow}）`;

    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: dateLabel } }],
      },
    });

    for (const slot of slots) {
      const emp = empMap.get(slot.employeeId);
      if (!emp) continue;
      const billable = calcBillableHours(slot.startTime, slot.endTime);
      const noteText = slot.note ? `　※${slot.note}` : '';
      const content = `${emp.name}　${slot.startTime}〜${slot.endTime}（${billable.toFixed(1)}h）${noteText}`;

      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content } }],
        },
      });
    }
  }

  return blocks;
}

async function appendBlocks(pageId: string, blocks: object[]) {
  const CHUNK_SIZE = 100;
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk = blocks.slice(i, i + CHUNK_SIZE);
    await notionRequest('POST', `/notion/blocks/${pageId}/children`, { children: chunk });
  }
}

export async function exportScheduleToNotion(
  schedule: Schedule,
  employees: Employee[],
  year: number,
  month: number,
): Promise<string> {
  const rawParentId = import.meta.env.VITE_NOTION_PARENT_PAGE_ID as string;
  if (!rawParentId) throw new Error('VITE_NOTION_PARENT_PAGE_ID が設定されていません');
  const uuidMatch = rawParentId.replace(/-/g, '').match(/[0-9a-f]{32}/i);
  if (!uuidMatch) throw new Error('VITE_NOTION_PARENT_PAGE_ID が正しくありません');
  const raw = uuidMatch[0];
  const parentPageId = `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;

  const pageTitle = `${year}年${month}月 シフト表`;
  const empMap = new Map<string, Employee>(employees.map(e => [e.id, e]));
  const blocks = buildBlocks(schedule, empMap);

  // 既存の同タイトルページを検索
  const searchRes = await notionRequest('POST', '/notion/search', {
    query: pageTitle,
    filter: { value: 'page', property: 'object' },
  });

  const existing = (searchRes.results ?? []).find(
    (p: any) =>
      p.parent?.page_id?.replace(/-/g, '') === raw &&
      p.properties?.title?.title?.[0]?.plain_text === pageTitle,
  );

  if (existing) {
    // 既存ページのブロックを全削除してから再追加（更新）
    await notionRequest('DELETE', `/notion/blocks/${existing.id}/children`);
    await appendBlocks(existing.id, blocks);
    return existing.url as string;
  } else {
    // 新規作成
    const CHUNK_SIZE = 100;
    const res = await notionRequest('POST', '/notion/pages', {
      parent: { page_id: parentPageId },
      properties: {
        title: [{ type: 'text', text: { content: pageTitle } }],
      },
      children: blocks.slice(0, CHUNK_SIZE),
    });
    await appendBlocks(res.id, blocks.slice(CHUNK_SIZE));
    return res.url as string;
  }
}
