<script lang="ts">
  import { onMount } from 'svelte';
  import { employees, selectedYear, selectedMonth, employeeTypes } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { Schedule } from '$lib/api.js';
  import { calcHours } from '$lib/utils.js';

  let schedule = $state<Schedule | null>(null);
  let loading = $state(true);

  onMount(() => load());
  $effect(() => { $selectedYear; $selectedMonth; load(); });

  async function load() {
    loading = true;
    try {
      const list = await api.schedules.list($selectedYear, $selectedMonth);
      schedule = list[0] ?? null;
    } catch {}
    loading = false;
  }

  interface Row {
    id: string;
    name: string;
    type: string;
    hourlyWage: number;
    totalMinutes: number;
    totalHours: number;
    salary: number;
    incomeLower: number | null;
    incomeUpper: number | null;
  }

  // 7時間以上のシフトは休憩1時間を差し引く
  function calcBillableHours(startTime: string, endTime: string): number {
    const h = calcHours(startTime, endTime);
    return h >= 7 ? h - 1 : h;
  }

  const rows = $derived.by<Row[]>(() => {
    if (!schedule || !$employees.length) return [];
    const map = new Map<string, number>();
    for (const slot of schedule.slots) {
      const h = calcBillableHours(slot.startTime, slot.endTime);
      map.set(slot.employeeId, (map.get(slot.employeeId) ?? 0) + h);
    }
    return $employees
      .filter(e => map.has(e.id))
      .map(e => {
        const totalHours = map.get(e.id)!;
        const totalMinutes = Math.round(totalHours * 60);
        return {
          id: e.id,
          name: e.name,
          type: e.type,
          hourlyWage: e.hourlyWage,
          totalMinutes,
          totalHours: Math.round(totalHours * 10) / 10,
          salary: Math.round(totalHours * e.hourlyWage),
          incomeLower: e.incomeLower ?? null,
          incomeUpper: e.incomeUpper ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  });

  const totalSalary = $derived(rows.reduce((s, r) => s + r.salary, 0));

  function formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
  }

  function formatCurrency(n: number): string {
    return n.toLocaleString('ja-JP') + '円';
  }
</script>

<svelte:head>
  <title>給与計算 {$selectedYear}年{$selectedMonth}月</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 print:bg-white">
  <!-- Screen header -->
  <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden">
    <div>
      <h1 class="text-xl font-bold text-gray-900">給与計算一覧</h1>
      <p class="text-sm text-gray-500 mt-0.5">{$selectedYear}年{$selectedMonth}月</p>
    </div>
    <button
      onclick={() => window.print()}
      class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
      </svg>
      PDF出力
    </button>
  </div>

  <!-- Print content -->
  <div class="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">
    <!-- Print title -->
    <div class="hidden print:block mb-6">
      <h1 class="text-2xl font-bold text-gray-900">給与計算一覧</h1>
      <p class="text-base text-gray-600 mt-1">{$selectedYear}年{$selectedMonth}月</p>
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-24 print:hidden">
        <div class="text-gray-400 text-sm">読み込み中...</div>
      </div>
    {:else if !schedule}
      <div class="flex items-center justify-center py-24 print:hidden">
        <div class="text-center">
          <p class="text-gray-400 text-sm">この月のシフトデータがありません</p>
        </div>
      </div>
    {:else if rows.length === 0}
      <div class="flex items-center justify-center py-24 print:hidden">
        <p class="text-gray-400 text-sm">シフトが登録されている従業員がいません</p>
      </div>
    {:else}
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 print:bg-gray-100">
              <th class="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">従業員名</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">種別</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">時給</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">総勤務時間</th>
              <th class="text-right px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">給与合計</th>
              <th class="text-center px-4 py-3 font-semibold text-gray-700 border-b border-gray-200 print:hidden">収入範囲</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row, i}
              {@const belowLower = row.incomeLower != null && row.salary < row.incomeLower}
              {@const aboveUpper = row.incomeUpper != null && row.salary > row.incomeUpper}
              <tr class="{i % 2 === 0 ? '' : 'bg-gray-50 print:bg-gray-50'} hover:bg-indigo-50 print:hover:bg-transparent transition-colors">
                <td class="px-4 py-3 font-medium border-b border-gray-100 {belowLower ? 'text-blue-700' : aboveUpper ? 'text-red-700' : 'text-gray-900'}">{row.name}</td>
                <td class="px-4 py-3 text-gray-600 border-b border-gray-100">{row.type}</td>
                <td class="px-4 py-3 text-right text-gray-700 border-b border-gray-100">{row.hourlyWage.toLocaleString('ja-JP')}円</td>
                <td class="px-4 py-3 text-right text-gray-700 border-b border-gray-100">{formatMinutes(row.totalMinutes)}</td>
                <td class="px-4 py-3 text-right font-semibold border-b border-gray-100 {belowLower ? 'text-blue-600' : aboveUpper ? 'text-red-600' : 'text-gray-900'}">{formatCurrency(row.salary)}</td>
                <td class="px-4 py-3 text-center border-b border-gray-100 print:hidden">
                  {#if belowLower}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">↓ 下限割れ</span>
                  {:else if aboveUpper}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">↑ 上限超過</span>
                  {:else if row.incomeLower != null || row.incomeUpper != null}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✓ 範囲内</span>
                  {:else}
                    <span class="text-gray-300 text-xs">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="bg-indigo-50 print:bg-gray-100">
              <td colspan="4" class="px-4 py-3 font-bold text-gray-900 text-right border-t-2 border-gray-300">合計</td>
              <td class="px-4 py-3 text-right font-bold text-indigo-700 print:text-gray-900 text-base border-t-2 border-gray-300">{formatCurrency(totalSalary)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p class="text-xs text-gray-400 mt-4 print:mt-6 print:text-gray-500">
        ※ 給与額は時給 × 勤務時間の計算のみです。7時間以上のシフトは休憩1時間を差し引いて計上しています。社会保険・所得税等は含みません。
      </p>
    {/if}
  </div>
</div>

<style>
  @media print {
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    :global(body) {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
</style>
