<script lang="ts">
  import { employees, showToast, employeeTypes } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { Employee, EmployeeType, EmployeePriority } from '$lib/api.js';

  const PRIORITY_LABELS: Record<EmployeePriority, string> = { high: '高', medium: '中', low: '低' };
  const PRIORITY_COLORS: Record<EmployeePriority, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-500',
  };

  let showModal = $state(false);
  let editTarget = $state<Employee | null>(null);
  let form = $state({ name: '', type: '', hourlyWage: 1177, color: '#6366f1', priority: 'medium' as EmployeePriority });

  const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4'];

  function openAdd() {
    editTarget = null;
    form = { name: '', type: $employeeTypes[0]?.name ?? '', hourlyWage: 1177, color: COLORS[Math.floor(Math.random() * COLORS.length)], priority: 'medium' };
    showModal = true;
  }
  function openEdit(emp: Employee) {
    editTarget = emp;
    form = { name: emp.name, type: emp.type, hourlyWage: emp.hourlyWage, color: emp.color, priority: emp.priority ?? 'medium' };
    showModal = true;
  }
  async function save() {
    try {
      if (editTarget) {
        const updated = await api.employees.update(editTarget.id, form);
        employees.update(list => list.map(e => e.id === updated.id ? updated : e));
        showToast('更新しました', 'success');
      } else {
        const created = await api.employees.create(form);
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
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">名前</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">種別</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">優先度</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">時給</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          {#each $employees as emp}
            {@const priority = (emp.priority ?? 'medium') as EmployeePriority}
            {@const typeColor = $employeeTypes.find(t => t.name === emp.type)?.color ?? '#6366f1'}
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {emp.color}"></div>
                  <span class="font-medium text-gray-900">{emp.name}</span>
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
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">{editTarget ? '従業員を編集' : '従業員を追加'}</h2>
      <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">名前 <span class="text-red-500">*</span></label>
          <input bind:value={form.name} required type="text" placeholder="山田 太郎"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">種別</label>
          <select bind:value={form.type} class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {#each $employeeTypes as t}
              <option value={t.name}>{t.name}</option>
            {/each}
            {#if $employeeTypes.length === 0}
              <option value="">タイプが未登録です</option>
            {/if}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">シフト優先度</label>
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
          <label class="block text-sm font-medium text-gray-700 mb-1">時給（円）</label>
          <input bind:value={form.hourlyWage} type="number" min="1"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">カレンダー表示色</label>
          <div class="flex flex-wrap gap-2">
            {#each COLORS as c}
              <button type="button" onclick={() => form.color = c}
                class="w-8 h-8 rounded-full border-2 transition-all {form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}"
                style="background-color: {c}"></button>
            {/each}
          </div>
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
