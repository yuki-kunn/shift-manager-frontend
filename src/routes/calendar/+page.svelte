<script lang="ts">
  import { onMount } from 'svelte';
  import { employees, selectedYear, selectedMonth, currentSchedule, showToast } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { Schedule, ScheduleSlot } from '$lib/api.js';
  import { getDaysInMonth, getDateString } from '$lib/utils.js';

  let schedule = $state<Schedule | null>(null);
  let selectedDate = $state<string | null>(null);
  let editSlot = $state<ScheduleSlot | null>(null);
  let editForm = $state({ startTime: '', endTime: '', note: '' });

  const DAY_NAMES = ['日','月','火','水','木','金','土'];
  // DAY_SHORT は下で定義

  onMount(() => loadSchedule());
  $effect(() => { $selectedYear; $selectedMonth; loadSchedule(); });

  async function loadSchedule() {
    try {
      const list = await api.schedules.list($selectedYear, $selectedMonth);
      schedule = list[0] ?? null;
      currentSchedule.set(schedule);
    } catch {}
  }

  function getSlotsForDate(date: string): ScheduleSlot[] {
    return schedule?.slots.filter(s => s.date === date) ?? [];
  }
  function getEmployee(id: string) { return $employees.find(e => e.id === id); }

  function selectDate(date: string) {
    selectedDate = date;
    editSlot = null;
  }

  function startEdit(slot: ScheduleSlot) {
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


  let daysInMonth = $derived(getDaysInMonth($selectedYear, $selectedMonth));
  let firstDay = $derived(new Date($selectedYear, $selectedMonth - 1, 1).getDay());
  let cells = $derived([
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      date: getDateString($selectedYear, $selectedMonth, i + 1),
    })),
  ]);
  let selectedSlots = $derived(selectedDate ? getSlotsForDate(selectedDate) : []);

  // 印刷用: 全日付リスト
  let printDays = $derived(
    Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = getDateString($selectedYear, $selectedMonth, day);
      const dow = new Date($selectedYear, $selectedMonth - 1, day).getDay();
      return { day, date, dow };
    })
  );

  // 印刷用: シフトがある従業員のみ
  let printEmployees = $derived(
    $employees.filter(emp => schedule?.slots.some(s => s.employeeId === emp.id))
  );

  function getSlot(empId: string, date: string) {
    return schedule?.slots.find(s => s.employeeId === empId && s.date === date) ?? null;
  }

  function printSchedule() {
    window.print();
  }
</script>

<div class="p-8">
  <div class="mb-6 flex items-center justify-between no-print">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">{$selectedYear}年{$selectedMonth}月 カレンダー</h1>
      <p class="text-gray-500 mt-1">シフト表の確認・微調整</p>
    </div>
    <div class="flex items-center gap-3">
      {#if !schedule}
        <p class="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">シフト未生成。ダッシュボードで生成してください。</p>
      {/if}
      {#if schedule}
        <button onclick={printSchedule}
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all shadow-sm">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          PDFで保存
        </button>
      {/if}
    </div>
  </div>

  <!-- 印刷専用レイアウト -->
  <div class="print-only">
    <div class="print-header">
      <h1>{$selectedYear}年{$selectedMonth}月 シフト表</h1>
    </div>
    <table class="print-table">
      <thead>
        <tr>
          <th class="name-col">氏名</th>
          {#each printDays as d}
            <th class="day-col {d.dow === 0 ? 'sun' : d.dow === 6 ? 'sat' : ''}">
              <div>{d.day}</div>
              <div class="dow">{DAY_NAMES[d.dow]}</div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each printEmployees as emp}
          <tr>
            <td class="name-cell">
              <span class="emp-dot" style="background:{emp.color}"></span>
              {emp.name}
            </td>
            {#each printDays as d}
              {@const slot = getSlot(emp.id, d.date)}
              <td class="shift-cell {d.dow === 0 ? 'sun-bg' : d.dow === 6 ? 'sat-bg' : ''}">
                {#if slot}
                  <div class="shift-bar" style="background:{emp.color}">
                    <span>{slot.startTime}</span>
                    <span>〜</span>
                    <span>{slot.endTime}</span>
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
        <span class="legend-item">
          <span class="emp-dot" style="background:{emp.color}"></span>
          {emp.name}
        </span>
      {/each}
    </div>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <div class="grid grid-cols-7 border-b border-gray-100">
      {#each DAY_NAMES as name, i}
        <div class="py-3 text-center text-xs font-semibold {i===0?'text-red-500':i===6?'text-blue-500':'text-gray-500'}">{name}</div>
      {/each}
    </div>
    <div class="grid grid-cols-7">
      {#each cells as cell}
        {#if cell === null}
          <div class="min-h-28 border-b border-r border-gray-50 bg-gray-50/30"></div>
        {:else}
          {@const dayName = DAY_NAMES[new Date($selectedYear, $selectedMonth-1, cell.day).getDay()]}
          {@const slots = getSlotsForDate(cell.date)}
          <button onclick={() => selectDate(cell.date)}
            class="min-h-28 border-b border-r border-gray-100 p-1.5 text-left w-full hover:bg-indigo-50/50 transition-colors {selectedDate === cell.date ? 'bg-indigo-50' : ''}">
            <span class="text-xs font-semibold block mb-1 {dayName==='日'?'text-red-500':dayName==='土'?'text-blue-500':'text-gray-600'}">{cell.day}</span>
            <div class="space-y-0.5">
              {#each slots as slot}
                {@const emp = getEmployee(slot.employeeId)}
                {#if emp}
                  <div class="text-xs px-1.5 py-0.5 rounded-md font-medium text-white truncate" style="background-color: {emp.color}">
                    {emp.name} {slot.startTime}〜{slot.endTime}
                  </div>
                {/if}
              {/each}
            </div>
          </button>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  /* 印刷専用ブロックは通常時は非表示 */
  .print-only { display: none; }

  @media print {
    /* サイドバー・操作UI・モーダルを消す */
    :global(aside), :global(.fixed) { display: none !important; }
    :global(main) { margin-left: 0 !important; }
    :global(body) { background: white !important; }

    /* 通常カレンダーと操作UIを非表示 */
    .no-print { display: none !important; }
    :global(.bg-white.rounded-2xl) { display: none !important; }
    :global(.p-8) > :not(.print-only) { display: none !important; }

    /* 印刷専用レイアウトを表示 */
    .print-only {
      display: block !important;
      font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
      font-size: 10px;
      color: #111;
    }

    .print-header h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 2px solid #333;
    }

    .print-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .print-table th, .print-table td {
      border: 1px solid #ccc;
      padding: 2px 1px;
      text-align: center;
      vertical-align: middle;
      overflow: hidden;
    }

    .name-col { width: 52px; text-align: left; padding-left: 4px; font-weight: bold; background: #f5f5f5; }
    .day-col { font-size: 9px; font-weight: bold; background: #f5f5f5; }
    .day-col .dow { font-size: 8px; color: #555; }
    .day-col.sun, .day-col.sun .dow { color: #dc2626; }
    .day-col.sat, .day-col.sat .dow { color: #2563eb; }

    .name-cell {
      text-align: left;
      padding-left: 4px;
      font-weight: 600;
      white-space: nowrap;
      font-size: 9px;
    }

    .shift-cell { padding: 1px; height: 28px; }
    .shift-cell.sun-bg { background: #fff5f5; }
    .shift-cell.sat-bg { background: #eff6ff; }

    .shift-bar {
      border-radius: 2px;
      color: white;
      font-size: 7.5px;
      font-weight: bold;
      padding: 1px 2px;
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.2;
      height: 100%;
      justify-content: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .emp-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-right: 3px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .print-legend {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 9px;
    }
    .legend-item { display: flex; align-items: center; }

    @page {
      size: A4 landscape;
      margin: 10mm;
    }
  }
</style>

{#if selectedDate}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="dialog" aria-modal="true">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 class="font-bold text-gray-900">{selectedDate} のシフト</h3>
        <button onclick={() => { selectedDate = null; editSlot = null; }} class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="p-4 space-y-3 max-h-96 overflow-y-auto">
        {#if selectedSlots.length === 0}
          <p class="text-center text-gray-400 py-4">この日のシフトはありません</p>
        {:else}
          {#each selectedSlots as slot}
            {@const emp = getEmployee(slot.employeeId)}
            {#if emp}
              <div class="border border-gray-100 rounded-xl p-3">
                {#if editSlot?.id === slot.id}
                  <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" style="background-color: {emp.color}"></div>
                      <span class="font-medium text-sm">{emp.name}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <input type="time" bind:value={editForm.startTime} class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                      <span class="text-gray-400">〜</span>
                      <input type="time" bind:value={editForm.endTime} class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                    <input type="text" bind:value={editForm.note} placeholder="備考" class="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    <div class="flex gap-2">
                      <button onclick={() => editSlot = null} class="flex-1 text-sm border border-gray-200 rounded-lg py-1.5 text-gray-600 hover:bg-gray-50">キャンセル</button>
                      <button onclick={saveSlot} class="flex-1 text-sm bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700">保存</button>
                    </div>
                  </div>
                {:else}
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" style="background-color: {emp.color}"></div>
                      <div>
                        <span class="font-medium text-sm text-gray-900">{emp.name}</span>
                        <p class="text-xs text-gray-500">{slot.startTime} 〜 {slot.endTime}{slot.note ? ` | ${slot.note}` : ''}</p>
                      </div>
                    </div>
                    <button onclick={() => startEdit(slot)} class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">編集</button>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
