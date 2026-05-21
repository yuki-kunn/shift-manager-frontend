<script lang="ts">
  import { onMount } from 'svelte';
  import { businessHours as bhStore, showToast } from '$lib/stores.js';
  import { api } from '$lib/api.js';

  let form = $state({ openTime: '09:00', closeTime: '21:00', longShiftThreshold: 6 });
  let saving = $state(false);

  onMount(async () => {
    try {
      const bh = await api.settings.getBusinessHours();
      form = { openTime: bh.openTime, closeTime: bh.closeTime, longShiftThreshold: bh.longShiftThreshold };
      bhStore.set(bh);
    } catch {}
  });

  async function save() {
    saving = true;
    try {
      const updated = await api.settings.updateBusinessHours(form);
      bhStore.set(updated);
      showToast('設定を保存しました', 'success');
    } catch { showToast('保存に失敗しました', 'error'); }
    finally { saving = false; }
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold text-gray-900">設定</h1>
    <p class="text-gray-500 mt-1">営業時間・シフトルール設定</p>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-lg">
    <h2 class="font-semibold text-gray-900 mb-5">営業時間設定</h2>
    <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-5">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">開店時間</label>
          <input bind:value={form.openTime} type="time" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">閉店時間</label>
          <input bind:value={form.closeTime} type="time" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">ロングシフト基準時間（時間）</label>
        <input bind:value={form.longShiftThreshold} type="number" min="1" max="24" class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        <p class="text-xs text-gray-400 mt-1">契約社員はこの時間以上のシフトが優先的に割り当てられます</p>
      </div>
      <button type="submit" disabled={saving} class="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all">
        {saving ? '保存中...' : '設定を保存'}
      </button>
    </form>
  </div>

  <div class="mt-6 bg-amber-50 border border-amber-100 rounded-2xl p-5 max-w-lg">
    <h3 class="font-semibold text-amber-900 mb-2">シフト制約について</h3>
    <ul class="text-sm text-amber-700 space-y-1">
      <li>• <strong>インターン・パート</strong>: 月収3〜5万円（時給1,173円）</li>
      <li>• <strong>契約社員</strong>: 時間制約なし、ロングシフト優先</li>
      <li>• AIシフト生成時にこれらの制約が自動適用されます</li>
    </ul>
  </div>
</div>
