<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import type { EmployeeType, BusinessHours } from '$lib/api.js';
  import { businessHours, employeeTypes, showToast } from '$lib/stores.js';

  let bh = $state<BusinessHours | null>(null);
  let types = $state<EmployeeType[]>([]);
  let saving = $state(false);

  // 新規タイプ追加フォーム
  let addingType = $state(false);
  let newTypeName = $state('');
  let newTypeColor = $state('#6366f1');

  // 編集中タイプ
  let editTypeId = $state<string | null>(null);
  let editTypeName = $state('');
  let editTypeColor = $state('');

  onMount(async () => {
    try {
      const [bhData, typesData] = await Promise.all([
        api.settings.getBusinessHours(),
        api.settings.listEmployeeTypes(),
      ]);
      bh = bhData;
      types = typesData;
      businessHours.set(bhData);
      employeeTypes.set(typesData);
    } catch { showToast('データ読み込みに失敗しました', 'error'); }
  });

  async function saveBh() {
    if (!bh) return;
    saving = true;
    try {
      const updated = await api.settings.updateBusinessHours({
        openTime: bh.openTime,
        closeTime: bh.closeTime,
        longShiftThreshold: bh.longShiftThreshold,
        minStaff: bh.minStaff,
        maxStaff: bh.maxStaff,
        fixedPrompt: bh.fixedPrompt,
      });
      bh = updated;
      businessHours.set(updated);
      showToast('設定を保存しました', 'success');
    } catch { showToast('保存に失敗しました', 'error'); }
    finally { saving = false; }
  }

  async function addType() {
    if (!newTypeName.trim()) return;
    try {
      const created = await api.settings.createEmployeeType({ name: newTypeName.trim(), color: newTypeColor });
      types = [...types, created];
      employeeTypes.set(types);
      newTypeName = '';
      newTypeColor = '#6366f1';
      addingType = false;
      showToast('タイプを追加しました', 'success');
    } catch { showToast('追加に失敗しました', 'error'); }
  }

  function startEdit(t: EmployeeType) {
    editTypeId = t.id;
    editTypeName = t.name;
    editTypeColor = t.color;
  }

  function cancelEdit() {
    editTypeId = null;
    editTypeName = '';
    editTypeColor = '';
  }

  async function updateType(id: string) {
    if (!editTypeName.trim()) return;
    try {
      const updated = await api.settings.updateEmployeeType(id, { name: editTypeName.trim(), color: editTypeColor });
      types = types.map(t => t.id === id ? updated : t);
      employeeTypes.set(types);
      cancelEdit();
      showToast('タイプを更新しました', 'success');
    } catch { showToast('更新に失敗しました', 'error'); }
  }

  async function deleteType(id: string) {
    if (!confirm('このタイプを削除しますか？')) return;
    try {
      await api.settings.deleteEmployeeType(id);
      types = types.filter(t => t.id !== id);
      employeeTypes.set(types);
      showToast('タイプを削除しました', 'success');
    } catch { showToast('削除に失敗しました', 'error'); }
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold text-gray-900">設定</h1>
    <p class="text-gray-500 mt-1">営業時間・シフトルール・従業員タイプ設定</p>
  </div>

  <!-- 営業時間設定 -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg mb-6">
    <h2 class="font-semibold text-gray-900 mb-5">営業時間・シフト設定</h2>
    {#if bh}
      <form onsubmit={(e) => { e.preventDefault(); saveBh(); }} class="space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開店時間</label>
            <input bind:value={bh.openTime} type="time" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">閉店時間</label>
            <input bind:value={bh.closeTime} type="time" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ロングシフト基準時間（時間）</label>
          <input bind:value={bh.longShiftThreshold} type="number" min="1" max="24" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          <p class="text-xs text-gray-400 mt-1">この時間以上のシフトがロングシフトと判定されます</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">最低同時勤務人数（人）</label>
          <input bind:value={bh.minStaff} type="number" min="1" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          <p class="text-xs text-gray-400 mt-1">営業開始〜終了まで、常にこの人数以上が同時に勤務している状態を維持します</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">最高同時勤務人数（人）</label>
          <input bind:value={bh.maxStaff} type="number" min="1" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          <p class="text-xs text-gray-400 mt-1">同時に勤務できる人数の上限です</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">固定プロンプト</label>
          <textarea bind:value={bh.fixedPrompt} rows="4"
            placeholder="例: 土日は必ず2人以上配置すること。Aさんは週3日以内にすること。"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-300 resize-none"></textarea>
          <p class="text-xs text-gray-400 mt-1">毎月のシフト生成時に常に適用される指示です。空欄の場合は適用されません。</p>
        </div>
        <button type="submit" disabled={saving} class="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all">
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </form>
    {:else}
      <p class="text-sm text-gray-400">読み込み中...</p>
    {/if}
  </div>

  <!-- 従業員タイプ管理 -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg mb-6">
    <div class="flex items-center justify-between mb-5">
      <h2 class="font-semibold text-gray-900">従業員タイプ管理</h2>
      {#if !addingType}
        <button onclick={() => { addingType = true; }} class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>追加
        </button>
      {/if}
    </div>

    <!-- タイプ一覧 -->
    <div class="space-y-2 mb-4">
      {#if types.length === 0}
        <p class="text-sm text-gray-400 py-2">タイプが登録されていません</p>
      {/if}
      {#each types as t}
        {#if editTypeId === t.id}
          <!-- 編集フォーム -->
          <div class="flex items-center gap-2 p-3 rounded-xl border border-indigo-200 bg-indigo-50">
            <input type="color" bind:value={editTypeColor} class="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"/>
            <input bind:value={editTypeName} type="text" placeholder="タイプ名" class="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <button onclick={() => updateType(t.id)} class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all">保存</button>
            <button onclick={cancelEdit} class="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all">キャンセル</button>
          </div>
        {:else}
          <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
            <div class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: {t.color}"></div>
            <span class="flex-1 text-sm font-medium text-gray-800">{t.name}</span>
            <button onclick={() => startEdit(t)} class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">編集</button>
            <button onclick={() => deleteType(t.id)} class="text-sm text-red-500 hover:text-red-700 font-medium">削除</button>
          </div>
        {/if}
      {/each}
    </div>

    <!-- 新規追加フォーム -->
    {#if addingType}
      <div class="flex items-center gap-2 p-3 rounded-xl border border-indigo-200 bg-indigo-50">
        <input type="color" bind:value={newTypeColor} class="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"/>
        <input bind:value={newTypeName} type="text" placeholder="タイプ名（例: パート）" class="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        <button onclick={addType} class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all">追加</button>
        <button onclick={() => { addingType = false; newTypeName = ''; newTypeColor = '#6366f1'; }} class="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all">キャンセル</button>
      </div>
    {/if}
  </div>

  <div class="mt-2 bg-amber-50 border border-amber-100 rounded-2xl p-5 max-w-lg">
    <h3 class="font-semibold text-amber-900 mb-2">シフト制約について</h3>
    <ul class="text-sm text-amber-700 space-y-1">
      <li>• <strong>優先度「高」</strong>の従業員から優先的にシフトへ割り当てられます</li>
      <li>• <strong>最低同時勤務人数</strong>: 営業時間中ずっとこの人数以上が常駐します</li>
      <li>• <strong>最高同時勤務人数</strong>: 同時勤務の上限人数を設定します</li>
      <li>• <strong>固定プロンプト</strong>: 毎月のシフト生成に常に適用されるカスタムルールです</li>
      <li>• AIシフト生成時にこれらの制約が自動適用されます</li>
    </ul>
  </div>
</div>
