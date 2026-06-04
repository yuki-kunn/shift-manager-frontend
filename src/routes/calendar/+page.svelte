<script lang="ts">
  import { onMount } from 'svelte';
  import { employees, selectedYear, selectedMonth, showToast, employeeTypeMap, facilitySettings, auth } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { Schedule, ScheduleSlot } from '$lib/api.js';
  import { getDaysInMonth, getDateString, calcHours, generateSmaregiCsv, type CsvRow } from '$lib/utils.js';
  import { exportScheduleToNotion } from '$lib/notionExport.js';
  import type { CalendarEvent } from '$lib/api.js';

  let schedule = $state<Schedule | null>(null);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let selectedDate = $state<string | null>(null);
  let editSlot = $state<ScheduleSlot | null>(null);
  let editForm = $state({ startTime: '', endTime: '', note: '' });
  let addingNew = $state(false);
  let newForm = $state({ employeeId: '', startTime: '', endTime: '', note: '' });

  const DAY_NAMES = ['日','月','火','水','木','金','土'];
  const now = new Date();

  onMount(() => loadSchedule());
  $effect(() => { $selectedYear; $selectedMonth; loadSchedule(); });

  async function loadSchedule() {
    try {
      const [list, evs] = await Promise.all([
        api.schedules.list($selectedYear, $selectedMonth),
        api.events.list($selectedYear, $selectedMonth),
      ]);
      schedule = list[0] ?? null;
      calendarEvents = evs;
    } catch {}
  }

  function getEventsForDate(date: string): CalendarEvent[] {
    return calendarEvents.filter(e => e.date === date);
  }

  function getSlotsForDate(date: string): ScheduleSlot[] {
    return schedule?.slots.filter(s => s.date === date) ?? [];
  }
  function getEmployee(id: string) { return $employees.find(e => e.id === id); }

  function selectDate(date: string) {
    selectedDate = date;
    editSlot = null;
    addingNew = false;
    newForm = { employeeId: $employees[0]?.id ?? '', startTime: '', endTime: '', note: '' };
  }

  function startEdit(slot: ScheduleSlot) {
    addingNew = false;
    editSlot = slot;
    editForm = { startTime: slot.startTime, endTime: slot.endTime, note: slot.note ?? '' };
  }

  async function saveSlot() {
    if (!editSlot || !schedule) return;
    try {
      const updated = await api.schedules.updateSlot(schedule.id, editSlot.id, editForm);
      schedule = { ...schedule, slots: schedule.slots.map(s => s.id === updated.id ? updated : s) };
      editSlot = null;
      showToast('シフトを更新しました', 'success');
    } catch { showToast('更新に失敗しました', 'error'); }
  }

  async function deleteSlot(slot: ScheduleSlot) {
    if (!schedule) return;
    if (!confirm('このシフトを削除しますか？')) return;
    try {
      await api.schedules.deleteSlot(schedule.id, slot.id);
      schedule = { ...schedule, slots: schedule.slots.filter(s => s.id !== slot.id) };
      showToast('削除しました', 'success');
    } catch { showToast('削除に失敗しました', 'error'); }
  }

  async function addSlot() {
    if (!schedule || !selectedDate || !newForm.employeeId || !newForm.startTime || !newForm.endTime) return;
    // フロント側重複チェック（同一日・同一従業員）
    const already = schedule.slots.some(
      s => s.employeeId === newForm.employeeId && s.date === selectedDate
    );
    if (already) {
      const emp = getEmployee(newForm.employeeId);
      showToast(`${emp?.name ?? 'このスタッフ'}はすでにこの日にシフトが登録されています`, 'error');
      return;
    }
    try {
      const added = await api.schedules.addSlot(schedule.id, {
        employeeId: newForm.employeeId, date: selectedDate,
        startTime: newForm.startTime, endTime: newForm.endTime, note: newForm.note || null,
      });
      schedule = { ...schedule, slots: [...schedule.slots, added] };
      addingNew = false;
      newForm = { employeeId: $employees[0]?.id ?? '', startTime: '', endTime: '', note: '' };
      showToast('シフトを追加しました', 'success');
    } catch (e: any) {
      // バックエンドの重複エラー(409)も拾う
      const msg = e?.message ?? '';
      if (msg.includes('409') || msg.includes('duplicate')) {
        const emp = getEmployee(newForm.employeeId);
        showToast(`${emp?.name ?? 'このスタッフ'}はすでにこの日にシフトが登録されています`, 'error');
      } else {
        showToast('追加に失敗しました', 'error');
      }
    }
  }

  // 出勤人数から重要度カラーを返す（セル背景色）
  function getDayImportanceClass(slotCount: number): string {
    if (slotCount === 0) return '';
    if (slotCount >= 5) return 'bg-red-50 border-red-200';
    if (slotCount >= 3) return 'bg-amber-50 border-amber-200';
    return 'bg-emerald-50 border-emerald-200';
  }

  // 週ごとにセルをグループ化して週次合計を計算
  function calcWeeklyHours(weekCells: ({ day: number; date: string } | null)[]): number {
    let total = 0;
    for (const cell of weekCells) {
      if (!cell) continue;
      for (const slot of getSlotsForDate(cell.date)) {
        total += calcHours(slot.startTime, slot.endTime);
      }
    }
    return Math.round(total * 10) / 10;
  }

  let daysInMonth = $derived(getDaysInMonth($selectedYear, $selectedMonth));
  let firstDay = $derived(new Date($selectedYear, $selectedMonth - 1, 1).getDay());

  // 週ごとに分割したセル配列
  let weekRows = $derived.by(() => {
    const allCells: ({ day: number; date: string } | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        date: getDateString($selectedYear, $selectedMonth, i + 1),
      })),
    ];
    const rows: ({ day: number; date: string } | null)[][] = [];
    for (let i = 0; i < allCells.length; i += 7) {
      rows.push(allCells.slice(i, i + 7));
    }
    return rows;
  });

  let selectedSlots = $derived(selectedDate ? getSlotsForDate(selectedDate) : []);

  // 印刷用
  let printDays = $derived(
    Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = getDateString($selectedYear, $selectedMonth, day);
      const dow = new Date($selectedYear, $selectedMonth - 1, day).getDay();
      return { day, date, dow };
    })
  );
  let printEmployees = $derived(
    $employees.filter(emp => schedule?.slots.some(s => s.employeeId === emp.id))
  );
  function getSlot(empId: string, date: string) {
    return schedule?.slots.find(s => s.employeeId === empId && s.date === date) ?? null;
  }

  function printSchedule() { window.print(); }

  let exportingNotion = $state(false);
  async function exportToNotion() {
    if (!schedule) return;
    exportingNotion = true;
    try {
      const dbId = $facilitySettings?.notionDatabaseId ?? '';
      if (!dbId) { showToast('Notion データベース ID が設定されていません', 'error'); exportingNotion = false; return; }
      const url = await exportScheduleToNotion(schedule, $employees, $selectedYear, $selectedMonth, dbId);
      showToast('Notionに転記しました', 'success');
      window.open(url, '_blank');
    } catch (e) {
      showToast(`転記に失敗しました: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      exportingNotion = false;
    }
  }

  function exportToCsv() {
    if (!schedule) return;
    const facilityId = $facilitySettings?.smaregiBusinessId || $auth?.facilityId || '';
    const rows = schedule.slots.map(slot => ({
      employeeId: slot.employeeId,
      facilityId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
    // 日付→従業員名の順でソート
    rows.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const nameA = $employees.find(e => e.id === a.employeeId)?.name ?? '';
      const nameB = $employees.find(e => e.id === b.employeeId)?.name ?? '';
      return nameA.localeCompare(nameB, 'ja');
    });
    const csv = generateSmaregiCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift_${$selectedYear}${String($selectedMonth).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSVをダウンロードしました', 'success');
  }
</script>

<div class="p-8">
  <div class="mb-6 flex items-center justify-between no-print">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">{$selectedYear}年{$selectedMonth}月 カレンダー</h1>
      <p class="text-gray-500 mt-1">シフト表の確認・編集</p>
    </div>
    <div class="flex items-center gap-3">
      <!-- 年月切り替え -->
      <div class="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1 shadow-sm">
        <button onclick={() => { const d = new Date($selectedYear, $selectedMonth - 2); selectedYear.set(d.getFullYear()); selectedMonth.set(d.getMonth() + 1); }}
          aria-label="前月"
          class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <select value={$selectedYear} onchange={(e) => selectedYear.set(Number((e.target as HTMLSelectElement).value))}
          aria-label="年を選択"
          class="text-sm font-medium text-gray-700 bg-transparent focus:outline-none px-1">
          {#each [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1] as y}
            <option value={y}>{y}年</option>
          {/each}
        </select>
        <select value={$selectedMonth} onchange={(e) => selectedMonth.set(Number((e.target as HTMLSelectElement).value))}
          aria-label="月を選択"
          class="text-sm font-medium text-gray-700 bg-transparent focus:outline-none px-1">
          {#each Array.from({length:12},(_,i)=>i+1) as m}
            <option value={m}>{m}月</option>
          {/each}
        </select>
        <button onclick={() => { const d = new Date($selectedYear, $selectedMonth); selectedYear.set(d.getFullYear()); selectedMonth.set(d.getMonth() + 1); }}
          aria-label="次月"
          class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      {#if !schedule}
        <p class="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">シフト未生成。ダッシュボードで生成してください。</p>
      {/if}
      {#if schedule}
        <button onclick={printSchedule}
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all shadow-sm">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          シフト表を印刷
        </button>
        {#if $facilitySettings?.csvEnabled && $facilitySettings?.smaregiBusinessId}
          <button onclick={exportToCsv}
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all shadow-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            CSVエクスポート
          </button>
        {/if}
        {#if $facilitySettings?.notionEnabled && $facilitySettings?.notionDatabaseId}
          <button onclick={exportToNotion} disabled={exportingNotion}
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl font-medium text-sm hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm">
            {#if exportingNotion}
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              転記中...
            {:else}
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 4h6v6H4V4zm0 10h6v6H4v-6zm10-10h6v6h-6V4zm0 10h6v6h-6v-6z"/>
              </svg>
              Notionに転記
            {/if}
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <!-- 重要度カラー凡例 -->
  {#if schedule}
    <div class="mb-3 flex items-center gap-4 text-xs text-gray-500 no-print">
      <span class="font-medium">出勤人数の目安：</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 inline-block"></span>1〜2名</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block"></span>3〜4名</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block"></span>5名以上</span>
    </div>
  {/if}

  <!-- 印刷専用レイアウト（シフト表） -->
  <div class="print-only">
    <div class="print-header"><h1>{$selectedYear}年{$selectedMonth}月 シフト表</h1></div>
    <table class="print-table">
      <thead>
        <tr>
          <th class="name-col">氏名</th>
          {#each printDays as d}
            <th class="day-col {d.dow === 0 ? 'sun' : d.dow === 6 ? 'sat' : ''}">
              <div>{d.day}</div><div class="dow">{DAY_NAMES[d.dow]}</div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each printEmployees as emp}
          <tr>
            <td class="name-cell"><span class="emp-dot" style="background:{emp.color}"></span>{emp.name}</td>
            {#each printDays as d}
              {@const slot = getSlot(emp.id, d.date)}
              <td class="shift-cell {d.dow === 0 ? 'sun-bg' : d.dow === 6 ? 'sat-bg' : ''}">
                {#if slot}
                  <div class="shift-bar" style="background:{emp.color}">
                    <span>{slot.startTime}</span><span>〜</span><span>{slot.endTime}</span>
                  </div>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="print-legend">
      {#each printEmployees as emp}
        <span class="legend-item"><span class="emp-dot" style="background:{emp.color}"></span>{emp.name}</span>
      {/each}
    </div>
  </div>

  <!-- カレンダー本体 -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <!-- 曜日ヘッダー -->
    <div class="grid grid-cols-8 border-b border-gray-100">
      {#each DAY_NAMES as name, i}
        <div class="py-3 text-center text-xs font-semibold {i===0?'text-red-500':i===6?'text-blue-500':'text-gray-500'}">{name}</div>
      {/each}
      <div class="py-3 text-center text-xs font-semibold text-indigo-400">週計</div>
    </div>

    <!-- 週行 -->
    {#each weekRows as week, wi}
      <div class="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
        {#each week as cell}
          {#if cell === null}
            <div class="min-h-28 border-r border-gray-50 bg-gray-50/30"></div>
          {:else}
            {@const dayOfWeek = new Date($selectedYear, $selectedMonth-1, cell.day).getDay()}
            {@const dayName = DAY_NAMES[dayOfWeek]}
            {@const slots = getSlotsForDate(cell.date)}
            {@const dayEvents = getEventsForDate(cell.date)}
            {@const importanceClass = getDayImportanceClass(slots.length)}
            <button onclick={() => selectDate(cell.date)}
              class="min-h-28 border-r border-gray-100 p-1.5 text-left w-full hover:brightness-95 transition-all {selectedDate === cell.date ? 'ring-2 ring-inset ring-indigo-400' : ''} {importanceClass}">
              <span class="text-xs font-semibold block mb-1 {dayName==='日'?'text-red-500':dayName==='土'?'text-blue-500':'text-gray-600'}">{cell.day}</span>
              <div class="space-y-0.5">
                {#each slots as slot}
                  {@const emp = getEmployee(slot.employeeId)}
                  {#if emp}
                    {@const isEventStaff = dayEvents.some(ev => ev.members.some(m => m.employeeId === slot.employeeId))}
                    {@const typeColor = $employeeTypeMap.get(emp.type)?.color ?? '#6366f1'}
                    {@const slotColor = isEventStaff ? '#ef4444' : typeColor}
                    <div class="text-xs px-1.5 py-0.5 rounded-md font-medium text-white truncate" style="background-color: {slotColor}">
                      {emp.name} {slot.startTime}〜{slot.endTime}
                    </div>
                  {/if}
                {/each}
              </div>
            </button>
          {/if}
        {/each}

        <!-- 週次合計セル -->
        <div class="min-h-28 border-gray-100 bg-indigo-50/40 flex flex-col items-center justify-center gap-1 px-1">
          <span class="text-xs text-indigo-400 font-medium">週計</span>
          <span class="text-sm font-bold text-indigo-700">{calcWeeklyHours(week)}h</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .print-only { display: none; }
  @media print {
    :global(aside), :global(.fixed) { display: none !important; }
    :global(main) { margin-left: 0 !important; }
    :global(body) { background: white !important; }
    .no-print { display: none !important; }
    :global(.bg-white.rounded-2xl) { display: none !important; }
    :global(.p-8) > :not(.print-only) { display: none !important; }
    .print-only { display: block !important; font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; font-size: 10px; color: #111; }
    .print-header h1 { font-size: 16px; font-weight: bold; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #333; }
    .print-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .print-table th, .print-table td { border: 1px solid #ccc; padding: 2px 1px; text-align: center; vertical-align: middle; overflow: hidden; }
    .name-col { width: 52px; text-align: left; padding-left: 4px; font-weight: bold; background: #f5f5f5; }
    .day-col { font-size: 9px; font-weight: bold; background: #f5f5f5; }
    .day-col .dow { font-size: 8px; color: #555; }
    .day-col.sun, .day-col.sun .dow { color: #dc2626; }
    .day-col.sat, .day-col.sat .dow { color: #2563eb; }
    .name-cell { text-align: left; padding-left: 4px; font-weight: 600; white-space: nowrap; font-size: 9px; }
    .shift-cell { padding: 1px; height: 28px; }
    .shift-cell.sun-bg { background: #fff5f5; }
    .shift-cell.sat-bg { background: #eff6ff; }
    .shift-bar { border-radius: 2px; color: white; font-size: 7.5px; font-weight: bold; padding: 1px 2px; display: flex; flex-direction: column; align-items: center; line-height: 1.2; height: 100%; justify-content: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .emp-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-legend { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 10px; font-size: 9px; }
    .legend-item { display: flex; align-items: center; }
    @page { size: A4 landscape; margin: 10mm; }
  }
</style>

<!-- 日付クリックのサイドパネル -->
{#if selectedDate}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="dialog" aria-modal="true">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
      <!-- ヘッダー -->
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h3 class="font-bold text-gray-900">{selectedDate.replace(/-/g, '/')} のシフト</h3>
        <button onclick={() => { selectedDate = null; editSlot = null; addingNew = false; }} aria-label="閉じる" class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- シフト一覧 -->
      <div class="p-4 space-y-2 overflow-y-auto flex-1">
        {#if selectedSlots.length === 0 && !addingNew}
          <p class="text-center text-gray-400 py-4 text-sm">この日のシフトはありません</p>
        {/if}

        {#each selectedSlots as slot}
          {@const emp = getEmployee(slot.employeeId)}
          {#if emp}
            <div class="border border-gray-100 rounded-xl p-3">
              {#if editSlot?.id === slot.id}
                <!-- 編集フォーム -->
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {emp.color}"></div>
                    <span class="font-medium text-sm">{emp.name}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <input type="time" bind:value={editForm.startTime} class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"/>
                    <span class="text-gray-400 text-xs">〜</span>
                    <input type="time" bind:value={editForm.endTime} class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"/>
                  </div>
                  <input type="text" bind:value={editForm.note} placeholder="備考" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  <div class="flex gap-2">
                    <button onclick={() => editSlot = null} class="flex-1 text-sm border border-gray-200 rounded-lg py-1.5 text-gray-600 hover:bg-gray-50">キャンセル</button>
                    <button onclick={saveSlot} class="flex-1 text-sm bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700">保存</button>
                  </div>
                </div>
              {:else}
                <!-- 表示行 -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {emp.color}"></div>
                    <div class="min-w-0">
                      <span class="font-medium text-sm text-gray-900">{emp.name}</span>
                      <p class="text-xs text-gray-500">{slot.startTime} 〜 {slot.endTime}
                        <span class="text-gray-400">({calcHours(slot.startTime, slot.endTime).toFixed(1)}h)</span>
                        {slot.note ? ` | ${slot.note}` : ''}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button onclick={() => startEdit(slot)} class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">編集</button>
                    <button onclick={() => deleteSlot(slot)} class="text-xs text-red-400 hover:text-red-600 font-medium">削除</button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/each}

        <!-- 新規追加フォーム -->
        {#if addingNew && schedule}
          <div class="border-2 border-indigo-200 border-dashed rounded-xl p-3 space-y-2 bg-indigo-50/30">
            <p class="text-xs font-semibold text-indigo-700">シフトを追加</p>
            <label for="new-slot-employee" class="sr-only">スタッフを選択</label>
            <select id="new-slot-employee" bind:value={newForm.employeeId}
              class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {#each $employees as emp}
                <option value={emp.id}>{emp.name}</option>
              {/each}
            </select>
            <div class="flex items-center gap-2">
              <input type="time" bind:value={newForm.startTime} class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"/>
              <span class="text-gray-400 text-xs">〜</span>
              <input type="time" bind:value={newForm.endTime} class="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"/>
            </div>
            <input type="text" bind:value={newForm.note} placeholder="備考（任意）" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <div class="flex gap-2">
              <button onclick={() => addingNew = false} class="flex-1 text-sm border border-gray-200 rounded-lg py-1.5 text-gray-600 hover:bg-gray-50 bg-white">キャンセル</button>
              <button onclick={addSlot} disabled={!newForm.startTime || !newForm.endTime}
                class="flex-1 text-sm bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700 disabled:opacity-50">追加</button>
            </div>
          </div>
        {/if}
      </div>

      <!-- フッター：追加ボタン -->
      {#if schedule && !addingNew}
        <div class="px-4 pb-4 flex-shrink-0">
          <button onclick={() => { addingNew = true; editSlot = null; }}
            class="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            シフトを追加
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
