<script lang="ts">
  import { employees, selectedYear, selectedMonth, showToast, businessHours } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { ShiftRequest } from '$lib/api.js';
  import { getDaysInMonth, EMPLOYEE_TYPE_LABELS, EMPLOYEE_TYPE_COLORS } from '$lib/utils.js';

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
  let dowSettings = $state<DayOfWeekSetting[]>(Array.from({ length: 7 }, defaultDow));
  let exceptions = $state<ExceptionDay[]>([]);
  let nextExId = $state(1);
  let freeNote = $state('');
  let existingRequests = $state<Map<number, Partial<ShiftRequest>>>(new Map());
  let registeredMap = $state<Map<string, number>>(new Map());

  $effect(() => {
    if ($employees.length > 0 && !selectedEmployeeId) selectedEmployeeId = $employees[0].id;
  });

  $effect(() => {
    $selectedYear; $selectedMonth;
    loadAllRegistered();
  });

  $effect(() => {
    selectedEmployeeId; $selectedYear; $selectedMonth;
    loadExisting();
    resetForm();
  });

  async function loadAllRegistered() {
    try {
      const all = await api.shiftRequests.listByMonth($selectedYear, $selectedMonth);
      const map = new Map<string, number>();
      for (const r of all) {
        map.set(r.employeeId, (map.get(r.employeeId) ?? 0) + 1);
      }
      registeredMap = map;
    } catch {}
  }

  async function loadExisting() {
    if (!selectedEmployeeId) return;
    try {
      const data = await api.shiftRequests.list(selectedEmployeeId, $selectedYear, $selectedMonth);
      existingRequests = new Map(data.map(r => [r.day, r]));
    } catch {}
  }

  function selectEmployee(id: string) {
    const count = registeredMap.get(id) ?? 0;
    if (count > 0 && id !== selectedEmployeeId) {
      if (!confirm(`この従業員はすでに${count}日分の希望シフトが登録されています。\n上書きしますか？`)) return;
    }
    selectedEmployeeId = id;
  }

  function resetForm() {
    dowSettings = Array.from({ length: 7 }, defaultDow);
    exceptions = [];
    freeNote = '';
  }

  function addException() {
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

  function expandToMonth(): Map<number, { isAvailable: boolean; startTime: string | null; endTime: string | null; note: string | null }> {
    const days = getDaysInMonth($selectedYear, $selectedMonth);
    const result = new Map<number, { isAvailable: boolean; startTime: string | null; endTime: string | null; note: string | null }>();
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
    for (const ex of exceptions) {
      const days2 = getDaysInMonth($selectedYear, $selectedMonth);
      if (ex.day >= 1 && ex.day <= days2) {
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

  let preview = $derived.by(() => {
    const days = getDaysInMonth($selectedYear, $selectedMonth);
    const expanded = expandToMonth();
    const result = new Map<number, { isAvailable: boolean; startTime: string | null; endTime: string | null; note: string | null; isNew: boolean }>();
    for (let d = 1; d <= days; d++) {
      if (expanded.has(d)) {
        result.set(d, { ...expanded.get(d)!, isNew: true });
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
      registeredMap.set(selectedEmployeeId, (registeredMap.get(selectedEmployeeId) ?? 0) + data.length);
      registeredMap = new Map(registeredMap);
      resetForm();
      showToast(`${data.length}日分の希望シフトを保存しました`, 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      saving = false;
    }
  }
</script>

<div class="flex" style="height: calc(100vh)">

  <!-- 左: 従業員リスト -->
  <aside class="w-52 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
    <div class="px-4 py-4 border-b border-gray-100">
      <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">従業員</h2>
      <p class="text-xs text-gray-400 mt-0.5">{$selectedYear}年{$selectedMonth}月</p>
    </div>
    <div class="flex-1 overflow-y-auto py-2">
      {#if $employees.length === 0}
        <div class="px-4 py-6 text-center">
          <p class="text-xs text-gray-400">従業員がいません</p>
          <a href="/employees" class="mt-2 inline-block text-xs text-indigo-600 hover:underline">登録する →</a>
        </div>
      {:else}
        {#each $employees as emp}
          {@const registered = (registeredMap.get(emp.id) ?? 0) > 0}
          {@const isSelected = selectedEmployeeId === emp.id}
          <button
            onclick={() => selectEmployee(emp.id)}
            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors
              {isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}"
          >
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: {emp.color}"></div>
            <span class="flex-1 text-sm font-medium truncate">{emp.name}</span>
            {#if registered}
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="登録済"></span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
    <!-- 凡例 -->
    <div class="px-4 py-3 border-t border-gray-100">
      <div class="flex items-center gap-1.5 text-xs text-gray-400">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
        登録済み
      </div>
    </div>
  </aside>

  <!-- 中・右: メインコンテンツ -->
  {#if !selectedEmployeeId || $employees.length === 0}
    <div class="flex-1 flex items-center justify-center text-gray-400 text-sm">
      従業員を選択してください
    </div>
  {:else}
    {@const emp = $employees.find(e => e.id === selectedEmployeeId)}
    {#if emp}
      <div class="flex-1 flex overflow-hidden">

        <!-- 中: 入力フォーム -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">

          <!-- ヘッダー -->
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {emp.color}"></div>
            <h1 class="text-lg font-bold text-gray-900">{emp.name}</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {EMPLOYEE_TYPE_COLORS[emp.type]}">
              {EMPLOYEE_TYPE_LABELS[emp.type]}
            </span>
            {#if (registeredMap.get(emp.id) ?? 0) > 0}
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">登録済</span>
            {/if}
          </div>

          <!-- 曜日設定 -->
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-5 py-3.5 border-b border-gray-100">
              <h2 class="font-semibold text-gray-900 text-sm">曜日設定</h2>
              <p class="text-xs text-gray-400 mt-0.5">勤務できる曜日にチェックを入れ、時間帯を設定</p>
            </div>
            <div class="p-4 space-y-2">
              {#each DAY_NAMES as name, i}
                {@const dow = dowSettings[i]}
                {@const isSun = i === 0}
                {@const isSat = i === 6}
                <div class="rounded-xl border transition-all {dow.enabled ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50/30'}">
                  <div class="flex items-center gap-3 px-4 py-2.5">
                    <input type="checkbox" bind:checked={dow.enabled}
                      onchange={() => {
                        if (dow.enabled) {
                          dow.startTime = $businessHours?.openTime ?? '';
                          dow.endTime = $businessHours?.closeTime ?? '';
                        }
                      }}
                      class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"/>
                    <span class="w-5 text-sm font-semibold flex-shrink-0
                      {isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}">{name}</span>

                    {#if dow.enabled}
                      <label class="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                        <input type="checkbox" bind:checked={dow.isAvailable}
                          class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                        <span class="text-xs text-gray-600">出勤可</span>
                      </label>
                      {#if dow.isAvailable}
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
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 class="font-semibold text-gray-900 text-sm">例外日</h2>
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
                <p class="text-center text-sm text-gray-300 py-4">例外なし</p>
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
                        <button onclick={() => removeException(ex.id)} aria-label="削除" class="text-gray-300 hover:text-red-400 transition-colors">
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
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-5 py-3.5 border-b border-gray-100">
              <h2 class="font-semibold text-gray-900 text-sm">その他の希望・備考</h2>
              <p class="text-xs text-gray-400 mt-0.5">自由記述（例: 平日にも入りたい、水曜は早めに上がりたい）</p>
            </div>
            <div class="p-4">
              <textarea bind:value={freeNote} rows="3"
                placeholder="例: 希望ですが平日にもバイト入りたいです。"
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
        <div class="w-56 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
          <div class="px-4 py-3.5 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900 text-sm">月間プレビュー</h2>
            <p class="text-xs text-gray-400 mt-0.5">オレンジ = 今回入力分</p>
          </div>
          <div class="flex-1 overflow-y-auto divide-y divide-gray-50">
            {#each Array.from({ length: getDaysInMonth($selectedYear, $selectedMonth) }, (_, i) => i + 1) as day}
              {@const entry = preview.get(day)}
              {@const dow = new Date($selectedYear, $selectedMonth - 1, day).getDay()}
              {@const isSun = dow === 0}
              {@const isSat = dow === 6}
              <div class="px-4 py-2 text-xs {entry?.isNew ? 'bg-orange-50' : ''}">
                <div class="flex items-center gap-2">
                  <span class="font-semibold w-12 flex-shrink-0 {isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}">
                    {$selectedMonth}/{day}（{['日','月','火','水','木','金','土'][dow]}）
                  </span>
                </div>
                <div class="mt-0.5 pl-1">
                  {#if entry}
                    {#if entry.isAvailable}
                      <span class="text-emerald-600 font-medium">出勤可</span>
                      {#if entry.startTime && entry.endTime}
                        <span class="text-gray-500 ml-1">{entry.startTime}〜{entry.endTime}</span>
                      {/if}
                    {:else}
                      <span class="text-red-400 font-medium">休み</span>
                    {/if}
                  {:else}
                    <span class="text-gray-300">未登録</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

      </div>
    {/if}
  {/if}
</div>
