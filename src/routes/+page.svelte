<script lang="ts">
  import { onMount } from 'svelte';
  import { employees, selectedYear, selectedMonth, showToast, employeeTypeMap } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { Schedule } from '$lib/api.js';
  import { calcHours, calcMonthlySalary } from '$lib/utils.js';

  let schedule = $state<Schedule | null>(null);
  let generating = $state(false);
  let generationNote = $state('');

  onMount(() => loadSchedule());
  $effect(() => { $selectedYear; $selectedMonth; loadSchedule(); });

  async function loadSchedule() {
    try {
      const list = await api.schedules.list($selectedYear, $selectedMonth);
      schedule = list[0] ?? null;
    } catch {}
  }

  async function generateSchedule() {
    generating = true;
    try {
      const s = await api.ai.generateSchedule($selectedYear, $selectedMonth, generationNote || undefined);
      schedule = s;
      showToast('シフトを生成しました！', 'success');
    } catch { showToast('シフト生成に失敗しました', 'error'); }
    finally { generating = false; }
  }

  function getEmployeeHours(empId: string): number {
    if (!schedule) return 0;
    const prefix = `${$selectedYear}-${String($selectedMonth).padStart(2, '0')}`;
    return schedule.slots.filter(s => s.employeeId === empId && s.date.startsWith(prefix))
      .reduce((sum, s) => sum + calcHours(s.startTime, s.endTime), 0);
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{$selectedYear}年{$selectedMonth}月 シフト概要</h1>
        <p class="text-gray-500 mt-1">シフト管理ダッシュボード</p>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex gap-4 items-end">
      <div class="flex-1">
        <label for="generation-note" class="block text-sm font-medium text-gray-700 mb-1.5">シフト生成への備考・指示（任意）</label>
        <textarea id="generation-note" bind:value={generationNote} rows="2"
          placeholder="例: ○○さんは今月シフトを減らしてください。△△と□□は同じ日に入れてください。"
          class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-300 resize-none"></textarea>
      </div>
      <button onclick={generateSchedule} disabled={generating}
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0">
        {#if generating}
          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>AI生成中...
        {:else}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>AIシフト生成
        {/if}
      </button>
    </div>
  </div>

  <div class="grid grid-cols-3 gap-6 mb-8">
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <p class="text-sm text-gray-500 font-medium">従業員数</p>
      <p class="text-3xl font-bold text-gray-900 mt-1">{$employees.length}</p>
    </div>
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <p class="text-sm text-gray-500 font-medium">シフト枠</p>
      <p class="text-3xl font-bold text-gray-900 mt-1">{schedule?.slots?.length ?? 0}</p>
    </div>
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <p class="text-sm text-gray-500 font-medium">ステータス</p>
      <p class="text-lg font-bold mt-1 {schedule ? 'text-emerald-600' : 'text-gray-400'}">
        {schedule ? (schedule.status === 'published' ? '公開中' : '下書き') : '未生成'}
      </p>
    </div>
  </div>

  {#if $employees.length > 0}
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-900">従業員別シフトサマリー</h2>
      </div>
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">従業員</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">種別</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">合計時間</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">推定月収</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">状態</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          {#each $employees as emp}
            {@const hours = getEmployeeHours(emp.id)}
            {@const salary = calcMonthlySalary(hours, emp.hourlyWage)}
            {@const over = emp.incomeUpper != null && salary > emp.incomeUpper}
            {@const under = emp.incomeLower != null && hours > 0 && salary < emp.incomeLower}
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-2 h-8 rounded-full" style="background-color: {emp.color}"></div>
                  <span class="font-medium text-gray-900">{emp.name}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                {@const empType = $employeeTypeMap.get(emp.type)}
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style="background-color: {empType?.color ?? '#6366f1'}">
                  {emp.type || '未設定'}
                </span>
              </td>
              <td class="px-6 py-4 text-right font-medium text-gray-900">{hours.toFixed(1)}h</td>
              <td class="px-6 py-4 text-right font-medium {over ? 'text-red-600' : under ? 'text-orange-500' : 'text-gray-900'}">
                ¥{salary.toLocaleString()}
              </td>
              <td class="px-6 py-4 text-right">
                {#if over}<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">上限超過</span>
                {:else if under}<span class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">下限未満</span>
                {:else if hours > 0}<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">適正</span>
                {:else}<span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">未配置</span>{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
      <p class="text-gray-400">従業員を登録してシフト管理を始めましょう</p>
      <a href="/employees" class="mt-4 inline-block text-indigo-600 font-medium hover:underline">従業員を登録する →</a>
    </div>
  {/if}
</div>
