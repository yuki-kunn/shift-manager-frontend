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

  <div class="print-title" style="display:none">{$selectedYear}年{$selectedMonth}月 シフト表</div>

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
  @media print {
    :global(body) { background: white !important; }
    :global(aside) { display: none !important; }
    :global(main.ml-64) { margin-left: 0 !important; }
    :global(.fixed) { display: none !important; }
    .no-print { display: none !important; }
    .print-title {
      display: block !important;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #111;
    }
    :global(.min-h-28) { min-height: 80px !important; }
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
