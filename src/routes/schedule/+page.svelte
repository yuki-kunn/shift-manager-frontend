<script lang="ts">
  import { employees, selectedYear, selectedMonth, showToast, businessHours } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { ShiftRequest } from '$lib/api.js';
  import { getDaysInMonth, EMPLOYEE_TYPE_LABELS, EMPLOYEE_TYPE_COLORS } from '$lib/utils.js';

  // 曜日インデックス: 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  interface DayOfWeekSetting {
    enabled: boolean;
    isAvailable: boolean;
    startTime: string;
    endTime: string;
  }

  interface ExceptionDay {
    id: number;
    day: number;
    isAvailable: boolean;
    startTime: string;
    endTime: string;
    note: string;
  }

  const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
  const defaultDow = (): DayOfWeekSetting => ({
    enabled: false,
    isAvailable: true,
    startTime: $businessHours?.openTime ?? '',
    endTime: $businessHours?.closeTime ?? '',
  });

  let selectedEmployeeId = $state('');
  let saving = $state(false);

  // 曜日ごとの設定 (index 0=日〜6=土)
  let dowSettings = $state<DayOfWeekSetting[]>(Array.from({ length: 7 }, defaultDow));

  // 例外日
  let exceptions = $state<ExceptionDay[]>([]);
  let nextExId = $state(1);

  // 備考
  let freeNote = $state('');

  // 既存データ
  let existingRequests = $state<Map<number, Partial<ShiftRequest>>>(new Map());

  $effect(() => {
    if ($employees.length > 0 && !selectedEmployeeId) selectedEmployeeId = $employees[0].id;
  });

  $effect(() => {
    selectedEmployeeId; $selectedYear; $selectedMonth;
    loadExisting();
    resetForm();
  });

  async function loadExisting() {
    if (!selectedEmployeeId) return;
    try {
      const data = await api.shiftRequests.list(selectedEmployeeId, $selectedYear, $selectedMonth);
      existingRequests = new Map(data.map(r => [r.day, r]));
    } catch {}
  }

  function resetForm() {
    dowSettings = Array.from({ length: 7 }, defaultDow);
    exceptions = [];
    freeNote = '';
  }

  function addException() {
    const days = getDaysInMonth($selectedYear, $selectedMonth);
    exceptions = [...exceptions, {
      id: nextExId++,
      day: 1,
      isAvailable: false,
      startTime: '',
      endTime: '',
      note: '',
    }];
  }

  function removeException(id: number) {
    exceptions = exceptions.filter(e => e.id !== id);
  }

  // 曜日設定 + 例外をその月の全日に展開
  function expandToMonth(): Map<number, { isAvailable: boolean; startTime: string | null; endTime: string | null; note: string | null }> {
    const days = getDaysInMonth($selectedYear, $selectedMonth);
    const result = new Map<number, { isAvailable: boolean; startTime: string | null; endTime: string | null; note: string | null }>();

    // 曜日ベースで埋める
    for (let d = 1; d <= days; d++) {
      const dow = new Date($selectedYear, $selectedMonth - 1, d).getDay();
      const setting = dowSettings[dow];
      if (setting.enabled) {
        result.set(d, {
          isAvailable: setting.isAvailable,
          startTime: setting.startTime || null,
          endTime: setting.endTime || null,
          note: null,
        });
      }
    }

    // 例外で上書き
    for (const ex of exceptions) {
      if (ex.day >= 1 && ex.day <= days) {
        result.set(ex.day, {
          isAvailable: ex.isAvailable,
          startTime: ex.startTime || null,
          endTime: ex.endTime || null,
          note: ex.note || null,
        });
      }
    }

    return result;
  }

  // プレビュー
  let preview = $derived.by(() => {
    const days = getDaysInMonth($selectedYear, $selectedMonth);
    const expanded = expandToMonth();
    const result = new Map<number, { isAvailable: boolean; startTime: string | null; endTime: string | null; note: string | null; isNew: boolean }>();
    for (let d = 1; d <= days; d++) {
      if (expanded.has(d)) {
        const r = expanded.get(d)!;
        result.set(d, { ...r, isNew: true });
      } else if (existingRequests.has(d)) {
        const r = existingRequests.get(d)!;
        result.set(d, {
          isAvailable: r.isAvailable ?? true,
          startTime: r.startTime ?? null,
          endTime: r.endTime ?? null,
          note: r.note ?? null,
          isNew: false,
        });
      }
    }
    return result;
  });

  let newDayCount = $derived(expandToMonth().size);

  async function save() {
    if (!selectedEmployeeId) return;
    const expanded = expandToMonth();
    if (expanded.size === 0) {
      showToast('曜日を1つ以上有効にしてください', 'info');
      return;
    }
    saving = true;
    try {
      const data = Array.from(expanded.entries()).map(([day, r]) => ({
        employeeId: selectedEmployeeId,
        year: $selectedYear,
        month: $selectedMonth,
        day,
        isAvailable: r.isAvailable,
        startTime: r.startTime,
        endTime: r.endTime,
        note: r.note,
      }));
      await api.shiftRequests.bulkUpsert(data);
      await loadExisting();
      resetForm();
      showToast(`${data.length}日分の希望シフトを保存しました`, 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      saving = false;
    }
  }
</script>

<div class="p-8">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">シフト希望入力</h1>
    <p class="text-gray-500 mt-1">{$selectedYear}年{$selectedMonth}月分 — 曜日ごとに希望を登録</p>
  </div>

  {#if $employees.length === 0}
    <div class="bg-white rounded-2xl p-8 text-center text-gray-400">
      <p>従業員を登録してください</p>
      <a href="/employees" class="mt-3 inline-block text-indigo-600 hover:underline font-medium">従業員を登録 →</a>
    </div>
  {:else}
    <!-- 従業員タブ -->
    <div class="flex gap-2 mb-6 flex-wrap">
      {#each $employees as emp}
        <button onclick={() => selectedEmployeeId = emp.id}
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
            {selectedEmployeeId === emp.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'}">
          <div class="w-2.5 h-2.5 rounded-full" style="background-color: {emp.color}"></div>
          {emp.name}
        </button>
      {/each}
    </div>

    {#if selectedEmployeeId}
      {@const emp = $employees.find(e => e.id === selectedEmployeeId)}
      {#if emp}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">

          <!-- 左: 入力フォーム -->
          <div class="space-y-4">

            <!-- 曜日設定 -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div class="w-3 h-3 rounded-full" style="background-color: {emp.color}"></div>
                <h2 class="font-semibold text-gray-900">{emp.name}</h2>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {EMPLOYEE_TYPE_COLORS[emp.type]}">
                  {EMPLOYEE_TYPE_LABELS[emp.type]}
                </span>
              </div>

              <div class="p-4 space-y-2">
                <p class="text-xs text-gray-400 mb-3">勤務できる曜日にチェックを入れ、時間帯を設定してください</p>
                {#each DAY_NAMES as name, i}
                  {@const dow = dowSettings[i]}
                  {@const isSun = i === 0}
                  {@const isSat = i === 6}
                  <div class="rounded-xl border transition-all {dow.enabled ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50/30'}">
                    <div class="flex items-center gap-3 px-4 py-2.5">
                      <!-- 有効化チェック -->
                      <input type="checkbox" bind:checked={dow.enabled}
                        onchange={() => {
                          if (dow.enabled) {
                            dow.startTime = $businessHours?.openTime ?? '';
                            dow.endTime = $businessHours?.closeTime ?? '';
                          }
                        }}
                        class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"/>
                      <!-- 曜日ラベル -->
                      <span class="w-5 text-sm font-semibold flex-shrink-0
                        {isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}">{name}</span>

                      {#if dow.enabled}
                        <!-- 出勤可否トグル -->
                        <label class="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                          <input type="checkbox" bind:checked={dow.isAvailable}
                            class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                          <span class="text-xs text-gray-600">出勤可</span>
                        </label>

                        {#if dow.isAvailable}
                          <!-- 時間帯 -->
                          <div class="flex items-center gap-1.5 flex-1 min-w-0">
                            <input type="time" bind:value={dow.startTime}
                              class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[110px]"/>
                            <span class="text-gray-400 text-xs flex-shrink-0">〜</span>
                            <input type="time" bind:value={dow.endTime}
                              class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[110px]"/>
                          </div>
                        {:else}
                          <span class="text-xs text-gray-400">休み</span>
                        {/if}
                      {:else}
                        <span class="text-xs text-gray-300">未設定</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- 例外日 -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 class="font-semibold text-gray-900">例外日</h2>
                  <p class="text-xs text-gray-400 mt-0.5">特定の日だけ曜日設定と異なる場合に追加</p>
                </div>
                <button onclick={addException}
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  追加
                </button>
              </div>

              <div class="p-4">
                {#if exceptions.length === 0}
                  <p class="text-center text-sm text-gray-300 py-4">例外なし（例: 特定日のみ不可 など）</p>
                {:else}
                  <div class="space-y-2">
                    {#each exceptions as ex (ex.id)}
                      <div class="border border-gray-100 rounded-xl p-3 bg-gray-50/50 space-y-2">
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-gray-500 flex-shrink-0">{$selectedMonth}月</span>
                          <input type="number" min="1" max={getDaysInMonth($selectedYear, $selectedMonth)}
                            bind:value={ex.day}
                            class="w-14 text-sm border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                          <span class="text-xs text-gray-500 flex-shrink-0">日</span>

                          <label class="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" bind:checked={ex.isAvailable}
                              onchange={() => {
                                if (ex.isAvailable) {
                                  ex.startTime = $businessHours?.openTime ?? '';
                                  ex.endTime = $businessHours?.closeTime ?? '';
                                }
                              }}
                              class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                            <span class="text-xs text-gray-600">出勤可</span>
                          </label>

                          {#if ex.isAvailable}
                            <input type="time" bind:value={ex.startTime}
                              class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[100px]"/>
                            <span class="text-xs text-gray-400">〜</span>
                            <input type="time" bind:value={ex.endTime}
                              class="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[100px]"/>
                          {/if}

                          <div class="flex-1"></div>
                          <button onclick={() => removeException(ex.id)} class="text-gray-300 hover:text-red-400 transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>

                        <input type="text" bind:value={ex.note} placeholder="備考（例: 試験のため不可）"
                          class="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-300"/>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>

            <!-- 備考 -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-100">
                <h2 class="font-semibold text-gray-900">その他の希望・備考</h2>
                <p class="text-xs text-gray-400 mt-0.5">自由記述（例: 平日にも入りたい、水曜は早めに上がりたい）</p>
              </div>
              <div class="p-4">
                <textarea bind:value={freeNote} rows="3"
                  placeholder="例: 希望ですが平日にもバイト入りたいです。水曜・日曜は9:45〜だと助かります。"
                  class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-300 resize-none"></textarea>
              </div>
            </div>

            <!-- 保存ボタン -->
            <button onclick={save} disabled={saving || newDayCount === 0}
              class="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
              {saving ? '保存中...' : newDayCount > 0 ? `${newDayCount}日分を保存` : '曜日を選択してください'}
            </button>
          </div>

          <!-- 右: 月間プレビュー -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden self-start sticky top-4">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <h2 class="font-semibold text-gray-900">月間プレビュー</h2>
              <span class="text-xs text-gray-400">（オレンジ = 今回入力分）</span>
            </div>
            <div class="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {#each Array.from({ length: getDaysInMonth($selectedYear, $selectedMonth) }, (_, i) => i + 1) as day}
                {@const entry = preview.get(day)}
                {@const dow = new Date($selectedYear, $selectedMonth - 1, day).getDay()}
                {@const dayName = DAY_NAMES[dow]}
                {@const isSun = dow === 0}
                {@const isSat = dow === 6}
                <div class="px-4 py-2 flex items-center gap-3 text-sm {entry?.isNew ? 'bg-orange-50' : ''}">
                  <div class="w-14 flex-shrink-0 text-center">
                    <span class="font-semibold {isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}">{$selectedMonth}/{day}</span>
                    <span class="block text-xs {isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-400'}">{dayName}</span>
                  </div>
                  {#if entry}
                    {#if entry.isAvailable}
                      <span class="text-emerald-600 font-medium text-xs">出勤可</span>
                      {#if entry.startTime && entry.endTime}
                        <span class="text-gray-600 text-xs">{entry.startTime} 〜 {entry.endTime}</span>
                      {:else}
                        <span class="text-gray-400 text-xs">時間未定</span>
                      {/if}
                      {#if entry.note}
                        <span class="text-gray-400 text-xs truncate">{entry.note}</span>
                      {/if}
                    {:else}
                      <span class="text-red-400 font-medium text-xs">休み</span>
                      {#if entry.note}
                        <span class="text-gray-400 text-xs truncate">{entry.note}</span>
                      {/if}
                    {/if}
                  {:else}
                    <span class="text-gray-300 text-xs">未登録</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

        </div>
      {/if}
    {/if}
  {/if}
</div>
