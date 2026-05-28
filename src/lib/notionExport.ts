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

function calcHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

function calcBillableHours(startTime: string, endTime: string): number {
  const h = calcHours(startTime, endTime);
  return h >= 7 ? h - 1 : h;
}

/** 区分(type)の日本語表記 */
function typeLabel(type: string): string {
  const map: Record<string, string> = {
    employee: '社員',
    part_time: 'パート',
    contract: '契約社員',
    intern: 'インターン',
  };
  return map[type] ?? type;
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

  const pageTitle = `${year}年${month}月 シフト表`;

  // --- サマリーブロック ---
  const totalSlots = schedule.slots.length;
  const totalHours = schedule.slots.reduce((sum, slot) => {
    return sum + calcBillableHours(slot.startTime, slot.endTime);
  }, 0);

  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{ type: 'text', text: { content: `${year}年${month}月 シフト合計: ${totalSlots}件 / 総勤務時間: ${totalHours.toFixed(1)}h（7h以上は休憩1h控除済み）` } }],
      icon: { emoji: '📋' },
      color: 'blue_background',
    },
  });

  blocks.push({ object: 'block', type: 'divider', divider: {} });

  // --- 日付ごとのブロック ---
  for (const date of sortedDates) {
    const slots = byDate.get(date)!.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const d = new Date(date);
    const dow = dayNames[d.getDay()];
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}（${dow}）`;
    const dayHours = slots.reduce((sum, s) => sum + calcBillableHours(s.startTime, s.endTime), 0);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    // 日付見出し（土日はカラー区別）
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `${dateLabel}　` } },
          { type: 'text', text: { content: `${slots.length}名　計${dayHours.toFixed(1)}h` }, annotations: { color: isWeekend ? 'red' : 'gray' } },
        ],
        color: isWeekend ? 'red_background' : 'default',
      },
    });

    // 各スロット
    for (const slot of slots) {
      const emp = empMap.get(slot.employeeId);
      if (!emp) continue;
      const billable = calcBillableHours(slot.startTime, slot.endTime);
      const wage = emp.hourlyWage ?? 0;
      const amount = Math.round(billable * wage);
      const noteText = slot.note ? `　　※${slot.note}` : '';
      const typeTxt = typeLabel(emp.type);

      // メインテキスト: 名前 + 時間帯 + 時間数
      const mainText = `${emp.name}　${slot.startTime}〜${slot.endTime}（${billable.toFixed(1)}h）`;
      // サブテキスト: 区分 + 時給 + 金額
      const subText = `  [${typeTxt}] 時給¥${wage.toLocaleString()} × ${billable.toFixed(1)}h = ¥${amount.toLocaleString()}${noteText}`;

      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: mainText }, annotations: { bold: true } },
            { type: 'text', text: { content: subText }, annotations: { color: 'gray' } },
          ],
          color: 'default',
        },
      });
    }
  }

  // --- 月次集計ブロック ---
  blocks.push({ object: 'block', type: 'divider', divider: {} });
  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ type: 'text', text: { content: '📊 月次集計' } }] },
  });

  // 従業員別集計
  const empSummary = new Map<string, { hours: number; slots: number; amount: number }>();
  for (const slot of schedule.slots) {
    const emp = empMap.get(slot.employeeId);
    if (!emp) continue;
    const h = calcBillableHours(slot.startTime, slot.endTime);
    const cur = empSummary.get(emp.name) ?? { hours: 0, slots: 0, amount: 0 };
    cur.hours += h;
    cur.slots += 1;
    cur.amount += Math.round(h * (emp.hourlyWage ?? 0));
    empSummary.set(emp.name, cur);
  }

  for (const [name, summary] of Array.from(empSummary.entries()).sort((a, b) => b[1].hours - a[1].hours)) {
    blocks.push({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: `${name}　` }, annotations: { bold: true } },
          { type: 'text', text: { content: `${summary.slots}回　${summary.hours.toFixed(1)}h　¥${summary.amount.toLocaleString()}` } },
        ],
      },
    });
  }

  // Notion APIは1リクエストあたり最大100ブロックまで
  const CHUNK_SIZE = 100;
  const firstChunk = blocks.slice(0, CHUNK_SIZE);
  const restBlocks = blocks.slice(CHUNK_SIZE);

  // ページ作成（最初の100ブロックまで）
  const res = await notionPost('/notion/pages', {
    parent: { page_id: parentPageId },
    properties: {
      title: [{ type: 'text', text: { content: pageTitle } }],
    },
    children: firstChunk,
  });

  // 残りのブロックを100件ずつ追加
  if (restBlocks.length > 0) {
    const pageId = res.id as string;
    for (let i = 0; i < restBlocks.length; i += CHUNK_SIZE) {
      const chunk = restBlocks.slice(i, i + CHUNK_SIZE);
      await notionPost(`/notion/blocks/${pageId}/children`, { children: chunk });
    }
  }

  return res.url as string;
}
