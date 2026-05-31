<script lang="ts">
  import { onMount } from 'svelte';
  import { employees, selectedYear, selectedMonth, showToast, employeeTypes } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import type { CalendarEvent } from '$lib/api.js';

  let events = $state<CalendarEvent[]>([]);
  let loading = $state(true);

  // モーダル状態
  let showModal = $state(false);
  let editTarget = $state<CalendarEvent | null>(null);
  let form = $state({ date: '', title: '', description: '', color: '#6366f1' });

  // メンバー追加パネル
  let selectedEvent = $state<CalendarEvent | null>(null);
  let addingMemberId = $state('');
  let addingMemberNote = $state('');
  let addingMemberStart = $state('');
  let addingMemberEnd = $state('');

  const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4'];
  const DAY_NAMES = ['日','月','火','水','木','金','土'];

  onMount(() => load());
  $effect(() => { $selectedYear; $selectedMonth; load(); });

  async function load() {
    loading = true;
    try {
      events = await api.events.list($selectedYear, $selectedMonth);
    } catch { showToast('読み込みに失敗しました', 'error'); }
    loading = false;
  }

  function openAdd() {
    editTarget = null;
    const today = new Date();
    form = {
      date: `${$selectedYear}-${String($selectedMonth).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,
      title: '',
      description: '',
      color: '#6366f1',
    };
    showModal = true;
  }

  function openEdit(ev: CalendarEvent) {
    editTarget = ev;
    form = { date: ev.date, title: ev.title, description: ev.description ?? '', color: ev.color };
    showModal = true;
  }

  async function save() {
    if (!form.title || !form.date) return;
    try {
      if (editTarget) {
        const updated = await api.events.update(editTarget.id, form);
        events = events.map(e => e.id === updated.id ? { ...updated, members: e.members } : e);
        if (selectedEvent?.id === updated.id) selectedEvent = { ...updated, members: selectedEvent.members };
        showToast('更新しました', 'success');
      } else {
        const created = await api.events.create(form);
        events = [...events, created].sort((a, b) => a.date.localeCompare(b.date));
        showToast('作成しました', 'success');
      }
      showModal = false;
    } catch { showToast('保存に失敗しました', 'error'); }
  }

  async function remove(ev: CalendarEvent) {
    if (!confirm(`「${ev.title}」を削除しますか？`)) return;
    try {
      await api.events.delete(ev.id);
      events = events.filter(e => e.id !== ev.id);
      if (selectedEvent?.id === ev.id) selectedEvent = null;
      showToast('削除しました', 'success');
    } catch { showToast('削除に失敗しました', 'error'); }
  }

  async function addMember() {
    if (!selectedEvent || !addingMemberId) return;
    // 重複チェック
    if (selectedEvent.members.some(m => m.employeeId === addingMemberId)) {
      showToast('既に追加されています', 'error'); return;
    }
    try {
      const member = await api.events.addMember(
        selectedEvent.id, addingMemberId,
        addingMemberNote || undefined,
        addingMemberStart || undefined,
        addingMemberEnd || undefined,
      );
      const updated = { ...selectedEvent, members: [...selectedEvent.members, member] };
      selectedEvent = updated;
      events = events.map(e => e.id === updated.id ? updated : e);
      addingMemberId = $employees[0]?.id ?? '';
      addingMemberNote = '';
      addingMemberStart = '';
      addingMemberEnd = '';
      showToast('追加しました', 'success');
    } catch { showToast('追加に失敗しました', 'error'); }
  }

  async function removeMember(memberId: string) {
    if (!selectedEvent) return;
    try {
      await api.events.removeMember(selectedEvent.id, memberId);
      const updated = { ...selectedEvent, members: selectedEvent.members.filter(m => m.id !== memberId) };
      selectedEvent = updated;
      events = events.map(e => e.id === updated.id ? updated : e);
      showToast('削除しました', 'success');
    } catch { showToast('削除に失敗しました', 'error'); }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const dow = DAY_NAMES[d.getDay()];
    return `${d.getMonth()+1}/${d.getDate()}（${dow}）`;
  }

  // 日付でグループ化
  let grouped = $derived.by(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date)!.push(ev);
    }
    return Array.from(map.entries());
  });

  $effect(() => {
    if ($employees.length > 0 && !addingMemberId) {
      addingMemberId = $employees[0].id;
    }
  });
</script>

<div class="p-8">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">イベント管理</h1>
      <p class="text-gray-500 mt-1">{$selectedYear}年{$selectedMonth}月のイベント・特別日</p>
    </div>
    <button onclick={openAdd}
      class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
      </svg>
      イベントを追加
    </button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-24 text-gray-400 text-sm">読み込み中...</div>
  {:else if events.length === 0}
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
      <div class="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5"/>
        </svg>
      </div>
      <p class="text-gray-500 font-medium">この月のイベントはありません</p>
      <p class="text-gray-400 text-sm mt-1">「イベントを追加」ボタンから登録してください</p>
    </div>
  {:else}
    <div class="flex gap-6">
      <!-- イベント一覧 -->
      <div class="flex-1 space-y-4">
        {#each grouped as [date, dayEvents]}
          <div>
            <p class="text-xs font-semibold text-gray-400 uppercase mb-2">{formatDate(date)}</p>
            <div class="space-y-2">
              {#each dayEvents as ev}
                <div
                  class="bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-all hover:shadow-md {selectedEvent?.id === ev.id ? 'ring-2 ring-indigo-400' : 'border-gray-100'}"
                  onclick={() => { selectedEvent = ev; addingMemberId = $employees[0]?.id ?? ''; addingMemberNote = ''; }}
                  role="button" tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && (selectedEvent = ev)}>
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3 min-w-0">
                      <div class="w-3 h-3 rounded-full mt-1 flex-shrink-0" style="background-color: {ev.color}"></div>
                      <div class="min-w-0">
                        <p class="font-semibold text-gray-900 truncate">{ev.title}</p>
                        {#if ev.description}
                          <p class="text-sm text-gray-500 mt-0.5 line-clamp-2">{ev.description}</p>
                        {/if}
                        {#if ev.members.length > 0}
                          <div class="flex flex-wrap gap-1 mt-2">
                            {#each ev.members as member}
                              {@const emp = $employees.find(e => e.id === member.employeeId)}
                              {#if emp}
                                {@const typeColor = $employeeTypes.find(t => t.name === emp.type)?.color ?? '#6366f1'}
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                  style="background-color: {typeColor}">
                                  {emp.name}
                                </span>
                              {/if}
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button onclick={(e) => { e.stopPropagation(); openEdit(ev); }}
                        class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">編集</button>
                      <button onclick={(e) => { e.stopPropagation(); remove(ev); }}
                        class="text-xs text-red-400 hover:text-red-600 font-medium">削除</button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <!-- 従業員管理パネル -->
      {#if selectedEvent}
        <div class="w-80 flex-shrink-0">
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm sticky top-8">
            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {selectedEvent.color}"></div>
                <p class="font-semibold text-gray-900 truncate">{selectedEvent.title}</p>
              </div>
              <button onclick={() => selectedEvent = null} aria-label="閉じる" class="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- 参加従業員一覧 -->
            <div class="p-4 space-y-2">
              <p class="text-xs font-semibold text-gray-400 uppercase">参加スタッフ（{selectedEvent.members.length}名）</p>
              {#if selectedEvent.members.length === 0}
                <p class="text-sm text-gray-400 py-2">まだ追加されていません</p>
              {/if}
              {#each selectedEvent.members as member}
                {@const emp = $employees.find(e => e.id === member.employeeId)}
                {#if emp}
                  {@const memberTypeColor = $employeeTypes.find(t => t.name === emp.type)?.color ?? '#6366f1'}
                  <div class="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-gray-50">
                    <div class="flex items-center gap-2 min-w-0">
                      <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {memberTypeColor}"></div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                        {#if member.startTime && member.endTime}
                          <p class="text-xs text-indigo-600 font-medium">{member.startTime}〜{member.endTime}</p>
                        {/if}
                        {#if member.note}
                          <p class="text-xs text-gray-400 truncate">{member.note}</p>
                        {/if}
                      </div>
                    </div>
                    <button onclick={() => removeMember(member.id)} aria-label="削除"
                      class="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                {/if}
              {/each}
            </div>

            <!-- 従業員追加フォーム -->
            <div class="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
              <p class="text-xs font-semibold text-gray-400 uppercase">スタッフを追加</p>
              <label for="event-member-select" class="sr-only">スタッフを選択</label>
              <select id="event-member-select" bind:value={addingMemberId}
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {#each $employees as emp}
                  <option value={emp.id}>{emp.name}</option>
                {/each}
              </select>
              <div class="flex items-center gap-1.5">
                <input id="event-member-start" type="time" bind:value={addingMemberStart}
                  aria-label="シフト開始時間"
                  class="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                <span class="text-gray-400 text-xs flex-shrink-0">〜</span>
                <input id="event-member-end" type="time" bind:value={addingMemberEnd}
                  aria-label="シフト終了時間"
                  class="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <label for="event-member-note" class="sr-only">備考</label>
              <input id="event-member-note" type="text" bind:value={addingMemberNote} placeholder="備考（任意）"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              <button onclick={addMember} disabled={!addingMemberId}
                class="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all">
                追加
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- イベント作成・編集モーダル -->
{#if showModal}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="dialog" aria-modal="true">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">{editTarget ? 'イベントを編集' : 'イベントを追加'}</h2>
      <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-4">
        <div>
          <label for="event-date" class="block text-sm font-medium text-gray-700 mb-1">日付 <span class="text-red-500">*</span></label>
          <input id="event-date" bind:value={form.date} required type="date"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label for="event-title" class="block text-sm font-medium text-gray-700 mb-1">タイトル <span class="text-red-500">*</span></label>
          <input id="event-title" bind:value={form.title} required type="text" placeholder="例: 社内研修、周年イベント"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label for="event-description" class="block text-sm font-medium text-gray-700 mb-1">詳細（任意）</label>
          <textarea id="event-description" bind:value={form.description} rows="3" placeholder="イベントの詳細や備考を入力"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
        </div>
        <div>
          <p class="block text-sm font-medium text-gray-700 mb-2">カラー</p>
          <div class="flex flex-wrap gap-2">
            {#each COLORS as c}
              <button type="button" onclick={() => form.color = c}
                class="w-8 h-8 rounded-full border-2 transition-all {form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}"
                style="background-color: {c}" aria-label="カラー {c}"></button>
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
