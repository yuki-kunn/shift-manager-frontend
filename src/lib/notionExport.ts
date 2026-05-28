import type { Schedule, ScheduleSlot, Employee } from './api.js';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function notionFetch(path: string, body: object, token: string) {
  return fetch(`${NOTION_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(`Notion API error: ${r.status} ${JSON.stringify(err)}`);
    }
    return r.json();
  });
}

export async function exportScheduleToNotion(
  schedule: Schedule,
  employees: Employee[],
  year: number,
  month: number,
): Promise<string> {
  const token = import.meta.env.VITE_NOTION_TOKEN as string;
  const parentPageId = import.meta.env.VITE_NOTION_PARENT_PAGE_ID as string;

  if (!token || !parentPageId) {
    throw new Error('VITE_NOTION_TOKEN または VITE_NOTION_PARENT_PAGE_ID が設定されていません');
  }

  const empMap = new Map<string, Employee>(employees.map(e => [e.id, e]));

  // 日付ごとにスロットをグループ化
  const byDate = new Map<string, ScheduleSlot[]>();
  for (const slot of schedule.slots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date)!.push(slot);
  }

  const sortedDates = Array.from(byDate.keys()).sort();

  // Notionページのコンテンツを構築
  const blocks: object[] = [];

  for (const date of sortedDates) {
    const slots = byDate.get(date)!.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const d = new Date(date);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dow = dayNames[d.getDay()];
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}（${dow}）`;

    // 日付ヘッダー
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: dateLabel } }],
      },
    });

    // 各スロット
    for (const slot of slots) {
      const emp = empMap.get(slot.employeeId);
      if (!emp) continue;
      const hours = (() => {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      })();
      const noteText = slot.note ? `  ※${slot.note}` : '';
      const content = `${emp.name}　${slot.startTime} 〜 ${slot.endTime}（${hours.toFixed(1)}h）${noteText}`;

      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content } }],
        },
      });
    }
  }

  // ページ作成
  const pageTitle = `${year}年${month}月 シフト表`;
  const res = await notionFetch('/pages', {
    parent: { page_id: parentPageId },
    properties: {
      title: [{ type: 'text', text: { content: pageTitle } }],
    },
    children: blocks,
  }, token);

  return res.url as string;
}
