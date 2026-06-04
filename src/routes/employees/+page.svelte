<script lang="ts">
  import { employees, showToast, employeeTypes, employeeTypeMap } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { Employee, EmployeeType, EmployeePriority } from '$lib/api.js';

  const PRIORITY_LABELS: Record<EmployeePriority, string> = { high: '高', medium: '中', low: '低' };
  const PRIORITY_COLORS: Record<EmployeePriority, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-500',
  };
  const PRIORITY_ORDER: Record<EmployeePriority, number> = { high: 0, medium: 1, low: 2 };

  type SortKey = 'name' | 'type' | 'priority';
  type SortDir = 'asc' | 'desc';
  type SortCondition = { key: SortKey; dir: SortDir };

  const SORT_KEY_LABELS: Record<SortKey, string> = { name: '名前', type: '種別', priority: '優先度' };
  const STORAGE_KEY = 'emp-sort';

  function loadSortConditions(): SortCondition[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [{ key: 'name', dir: 'asc' }];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return [{ key: 'name', dir: 'asc' }];
  }

  function saveSortConditions(conditions: SortCondition[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conditions));
  }

  let sortConditions = $state<SortCondition[]>(loadSortConditions());

  // 追加ドロップダウン用
  let addKey = $state<SortKey>('type');

  // ヘッダークリック: 1番目の条件を操作（同キーなら昇降切替、別キーなら新たな1番目に）
  function toggleSort(key: SortKey) {
    const first = sortConditions[0];
    let next: SortCondition[];
    if (first?.key === key) {
      next = [{ key, dir: first.dir === 'asc' ? 'desc' : 'asc' }, ...sortConditions.slice(1)];
    } else {
      // 既存条件から同キーを除去して先頭に追加
      next = [{ key, dir: 'asc' }, ...sortConditions.filter(c => c.key !== key)];
    }
    sortConditions = next;
    saveSortConditions(next);
  }

  // 条件の昇降順を切り替え
  function toggleDir(idx: number) {
    const next = sortConditions.map((c, i) =>
      i === idx ? { ...c, dir: c.dir === 'asc' ? 'desc' as SortDir : 'asc' as SortDir } : c
    );
    sortConditions = next;
    saveSortConditions(next);
  }

  // 条件を削除（最低1つは残す）
  function removeCondition(idx: number) {
    if (sortConditions.length <= 1) return;
    const next = sortConditions.filter((_, i) => i !== idx);
    sortConditions = next;
    saveSortConditions(next);
  }

  // 条件を追加（既に同キーがあれば追加しない）
  function addCondition() {
    if (sortConditions.some(c => c.key === addKey)) return;
    const next = [...sortConditions, { key: addKey, dir: 'asc' as SortDir }];
    sortConditions = next;
    saveSortConditions(next);
    // 追加後は未使用のキーに切り替え
    const unused = (['name', 'type', 'priority'] as SortKey[]).find(k => !next.some(c => c.key === k));
    if (unused) addKey = unused;
  }

  // 追加可能なキー一覧（まだ条件に含まれていないもの）
  let availableKeys = $derived(
    (['name', 'type', 'priority'] as SortKey[]).filter(k => !sortConditions.some(c => c.key === k))
  );

  function compareEmployees(a: Employee, b: Employee, conditions: SortCondition[]): number {
    for (const { key, dir } of conditions) {
      let cmp = 0;
      if (key === 'name') cmp = (a.reading ?? a.name).localeCompare(b.reading ?? b.name, 'ja');
      else if (key === 'type') cmp = a.type.localeCompare(b.type, 'ja');
      else if (key === 'priority') cmp = PRIORITY_ORDER[(a.priority ?? 'medium') as EmployeePriority] - PRIORITY_ORDER[(b.priority ?? 'medium') as EmployeePriority];
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  }

  let sortedEmployees = $derived.by(() => {
    return [...$employees].sort((a, b) => compareEmployees(a, b, sortConditions));
  });

  let showModal = $state(false);
  let editTarget = $state<Employee | null>(null);
  let form = $state({
    name: '', reading: null as string | null, type: '', hourlyWage: 1177,
    priority: 'medium' as EmployeePriority,
    incomeLower: null as number | null, incomeUpper: null as number | null,
    smaregiEmployeeId: null as string | null,
  });

  function openAdd() {
    editTarget = null;
    form = { name: '', reading: null, type: $employeeTypes[0]?.name ?? '', hourlyWage: 1177, priority: 'medium', incomeLower: null, incomeUpper: null, smaregiEmployeeId: null };
    showModal = true;
  }
  function openEdit(emp: Employee) {
    editTarget = emp;
    form = { name: emp.name, reading: emp.reading ?? null, type: emp.type, hourlyWage: emp.hourlyWage, priority: emp.priority ?? 'medium', incomeLower: emp.incomeLower ?? null, incomeUpper: emp.incomeUpper ?? null, smaregiEmployeeId: emp.smaregiEmployeeId ?? null };
    showModal = true;
  }
  async function save() {
    const typeColor = $employeeTypeMap.get(form.type)?.color ?? '#6366f1';
    try {
      const payload = { ...form, reading: form.reading || null, color: typeColor };
      if (editTarget) {
        const updated = await api.employees.update(editTarget.id, payload);
        employees.update(list => list.map(e => e.id === updated.id ? updated : e));
        showToast('更新しました', 'success');
      } else {
        const created = await api.employees.create(payload);
        employees.update(list => [...list, created]);
        showToast('追加しました', 'success');
      }
      showModal = false;
    } catch { showToast('保存に失敗しました', 'error'); }
  }
  async function remove(id: string) {
    if (!confirm('削除しますか？')) return;
    try {
      await api.employees.delete(id);
      employees.update(list => list.filter(e => e.id !== id));
      showToast('削除しました', 'success');
    } catch { showToast('削除に失敗しました', 'error'); }
  }
</script>

<div class="p-8">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">従業員管理</h1>
      <p class="text-gray-500 mt-1">スタッフの登録・編集・削除</p>
    </div>
    <button onclick={openAdd} class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
      </svg>従業員を追加
    </button>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    {#if $employees.length === 0}
      <div class="p-12 text-center text-gray-400">従業員がいません。追加してください。</div>
    {:else}
      <!-- ソート条件バー -->
      <div class="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500 shrink-0">並び替え:</span>

        <!-- 現在の条件バッジ -->
        {#each sortConditions as cond, idx}
          <span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg
            {idx === 0 ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}">
            {#if idx > 0}
              <span class="text-gray-400 mr-0.5">→</span>
            {/if}
            <span>{SORT_KEY_LABELS[cond.key]}</span>
            <button onclick={() => toggleDir(idx)}
              class="hover:text-indigo-600 transition-colors font-bold"
              title="{cond.dir === 'asc' ? '昇順' : '降順'}（クリックで切替）">
              {cond.dir === 'asc' ? '▲' : '▼'}
            </button>
            {#if sortConditions.length > 1}
              <button onclick={() => removeCondition(idx)}
                class="ml-0.5 hover:text-red-500 transition-colors leading-none"
                title="この条件を削除">×</button>
            {/if}
          </span>
        {/each}

        <!-- 条件追加 -->
        {#if availableKeys.length > 0}
          <div class="flex items-center gap-1">
            <label for="sort-add-key" class="sr-only">追加する並び順</label>
            <select id="sort-add-key" bind:value={addKey}
              class="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
              {#each availableKeys as k}
                <option value={k}>{SORT_KEY_LABELS[k]}</option>
              {/each}
            </select>
            <button onclick={addCondition}
              class="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-50 transition-colors">
              + 追加
            </button>
          </div>
        {/if}
      </div>

      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <button onclick={() => toggleSort('name')} class="flex items-center gap-1 hover:text-gray-700 transition-colors">
                名前
                {#if sortConditions[0]?.key === 'name'}
                  <span class="text-indigo-500">{sortConditions[0].dir === 'asc' ? '▲' : '▼'}</span>
                {:else if sortConditions.some(c => c.key === 'name')}
                  {@const idx = sortConditions.findIndex(c => c.key === 'name')}
                  <span class="text-gray-400 text-[10px]">{idx + 1}{sortConditions[idx].dir === 'asc' ? '▲' : '▼'}</span>
                {:else}
                  <span class="text-gray-300">▲</span>
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <button onclick={() => toggleSort('type')} class="flex items-center gap-1 hover:text-gray-700 transition-colors">
                種別
                {#if sortConditions[0]?.key === 'type'}
                  <span class="text-indigo-500">{sortConditions[0].dir === 'asc' ? '▲' : '▼'}</span>
                {:else if sortConditions.some(c => c.key === 'type')}
                  {@const idx = sortConditions.findIndex(c => c.key === 'type')}
                  <span class="text-gray-400 text-[10px]">{idx + 1}{sortConditions[idx].dir === 'asc' ? '▲' : '▼'}</span>
                {:else}
                  <span class="text-gray-300">▲</span>
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <button onclick={() => toggleSort('priority')} class="flex items-center gap-1 hover:text-gray-700 transition-colors">
                優先度
                {#if sortConditions[0]?.key === 'priority'}
                  <span class="text-indigo-500">{sortConditions[0].dir === 'asc' ? '▲' : '▼'}</span>
                {:else if sortConditions.some(c => c.key === 'priority')}
                  {@const idx = sortConditions.findIndex(c => c.key === 'priority')}
                  <span class="text-gray-400 text-[10px]">{idx + 1}{sortConditions[idx].dir === 'asc' ? '▲' : '▼'}</span>
                {:else}
                  <span class="text-gray-300">▲</span>
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">時給</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">収入下限</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">収入上限</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          {#each sortedEmployees as emp}
            {@const priority = (emp.priority ?? 'medium') as EmployeePriority}
            {@const typeColor = $employeeTypeMap.get(emp.type)?.color ?? '#6366f1'}
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {typeColor}"></div>
                  <div>
                    <span class="font-medium text-gray-900">{emp.name}</span>
                    {#if emp.reading}
                      <p class="text-xs text-gray-400">{emp.reading}</p>
                    {/if}
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style="background-color: {typeColor}">
                  {emp.type || '未設定'}
                </span>
              </td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {PRIORITY_COLORS[priority]}">
                  {PRIORITY_LABELS[priority]}
                </span>
              </td>
              <td class="px-6 py-4 text-right text-gray-700">¥{emp.hourlyWage.toLocaleString()}/h</td>
              <td class="px-6 py-4 text-right text-gray-500 text-sm">
                {emp.incomeLower != null ? `¥${emp.incomeLower.toLocaleString()}` : '—'}
              </td>
              <td class="px-6 py-4 text-right text-gray-500 text-sm">
                {emp.incomeUpper != null ? `¥${emp.incomeUpper.toLocaleString()}` : '—'}
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-3">
                  <button onclick={() => openEdit(emp)} class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">編集</button>
                  <button onclick={() => remove(emp.id)} class="text-sm text-red-500 hover:text-red-700 font-medium">削除</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="dialog" aria-modal="true">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
      <h2 class="text-lg font-bold text-gray-900 mb-5">{editTarget ? '従業員を編集' : '従業員を追加'}</h2>
      <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-4">
        <div>
          <label for="emp-name" class="block text-sm font-medium text-gray-700 mb-1">名前 <span class="text-red-500">*</span></label>
          <input id="emp-name" bind:value={form.name} required type="text" placeholder="山田 太郎"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label for="emp-reading" class="block text-sm font-medium text-gray-700 mb-1">読み仮名（任意）</label>
          <input id="emp-reading"
            bind:value={form.reading}
            type="text" placeholder="例: やまだ たろう"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label for="emp-type" class="block text-sm font-medium text-gray-700 mb-1">種別</label>
          <select id="emp-type" bind:value={form.type} class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {#each $employeeTypes as t}
              <option value={t.name}>{t.name}</option>
            {/each}
            {#if $employeeTypes.length === 0}
              <option value="">タイプが未登録です</option>
            {/if}
          </select>
        </div>
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-1">シフト優先度</p>
          <div class="grid grid-cols-3 gap-2">
            {#each ([['high', '高', 'border-red-400 bg-red-50 text-red-700'], ['medium', '中', 'border-yellow-400 bg-yellow-50 text-yellow-700'], ['low', '低', 'border-gray-300 bg-gray-50 text-gray-500']] as const) as [val, label, cls]}
              <button type="button" onclick={() => form.priority = val}
                class="py-2 rounded-xl border-2 text-sm font-semibold transition-all
                  {form.priority === val ? cls : 'border-gray-200 bg-white text-gray-400'}">
                {label}
              </button>
            {/each}
          </div>
          <p class="text-xs text-gray-400 mt-1">高優先度の従業員が先にシフトへ割り当てられます</p>
        </div>
        <div>
          <label for="emp-wage" class="block text-sm font-medium text-gray-700 mb-1">時給（円）</label>
          <input id="emp-wage" bind:value={form.hourlyWage} type="number" min="1"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>

        <!-- 収入上下限 -->
        <div class="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
          <p class="text-sm font-medium text-gray-700">月収入の上下限（任意）</p>
          <p class="text-xs text-gray-400">給与計算画面でアラートとして表示されます</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="emp-income-lower" class="block text-xs font-medium text-gray-600 mb-1">下限（円）</label>
              <input id="emp-income-lower"
                type="number" min="0" placeholder="例: 50000"
                value={form.incomeLower ?? ''}
                oninput={(e) => { const v = (e.target as HTMLInputElement).value; form.incomeLower = v === '' ? null : Number(v); }}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"/>
            </div>
            <div>
              <label for="emp-income-upper" class="block text-xs font-medium text-gray-600 mb-1">上限（円）</label>
              <input id="emp-income-upper"
                type="number" min="0" placeholder="例: 100000"
                value={form.incomeUpper ?? ''}
                oninput={(e) => { const v = (e.target as HTMLInputElement).value; form.incomeUpper = v === '' ? null : Number(v); }}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"/>
            </div>
          </div>
        </div>

        <!-- Smaregi 従業員ID -->
        <div class="border border-gray-100 rounded-xl p-4 bg-gray-50">
          <label for="emp-smaregi-id" class="block text-sm font-medium text-gray-700 mb-1">Smaregi 従業員 ID（任意）</label>
          <input id="emp-smaregi-id"
            bind:value={form.smaregiEmployeeId}
            type="text" placeholder="例: 1001"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"/>
          <p class="text-xs text-gray-400 mt-1">CSV エクスポート時の「従業員ID」列に使用されます。未設定の場合はシステム内部 ID が使われます。</p>
        </div>

        <div class="flex gap-3 pt-2">
          <button type="button" onclick={() => showModal = false}
            class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">キャンセル</button>
          <button type="submit"
            class="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">保存</button>
        </div>
      </form>
    </div>
  </div>
{/if}
