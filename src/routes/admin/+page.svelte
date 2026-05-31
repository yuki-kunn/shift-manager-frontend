<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '$lib/api.js';
  import { auth, logout, showToast } from '$lib/stores.js';
  import { goto } from '$app/navigation';

  interface Facility { id: string; name: string; username: string; createdAt: string; }

  let facilities = $state<Facility[]>([]);
  let showModal = $state(false);
  let editPasswordId = $state<string | null>(null);
  let form = $state({ name: '', username: '', password: '' });
  let newPassword = $state('');
  let loading = $state(false);

  onMount(async () => {
    if (!$auth || $auth.role !== 'admin') { goto('/login'); return; }
    await loadFacilities();
  });

  async function loadFacilities() {
    try { facilities = await adminApi.listFacilities(); } catch {}
  }

  async function createFacility() {
    loading = true;
    try {
      await adminApi.createFacility(form);
      showToast('施設を追加しました', 'success');
      showModal = false;
      form = { name: '', username: '', password: '' };
      await loadFacilities();
    } catch (e: any) {
      showToast(e?.error ?? '追加に失敗しました', 'error');
    } finally { loading = false; }
  }

  async function deleteFacility(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？関連するデータも全て削除されます。`)) return;
    try {
      await adminApi.deleteFacility(id);
      showToast('削除しました', 'success');
      await loadFacilities();
    } catch { showToast('削除に失敗しました', 'error'); }
  }

  async function changePassword() {
    if (!editPasswordId || !newPassword) return;
    loading = true;
    try {
      await adminApi.changePassword(editPasswordId, newPassword);
      showToast('パスワードを変更しました', 'success');
      editPasswordId = null;
      newPassword = '';
    } catch { showToast('変更に失敗しました', 'error'); }
    finally { loading = false; }
  }

  function handleLogout() { logout(); goto('/login'); }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- ヘッダー -->
  <header class="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      </div>
      <div>
        <h1 class="font-bold text-gray-900">Shift Manager</h1>
        <p class="text-xs text-gray-400">管理者ダッシュボード</p>
      </div>
    </div>
    <button onclick={handleLogout}
      class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
      </svg>
      ログアウト
    </button>
  </header>

  <div class="p-8 max-w-4xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">施設管理</h2>
        <p class="text-gray-500 mt-1">営業施設のユーザーアカウント管理</p>
      </div>
      <button onclick={() => showModal = true}
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-sm">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>施設を追加
      </button>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {#if facilities.length === 0}
        <div class="p-12 text-center text-gray-400">施設が登録されていません</div>
      {:else}
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">施設名</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ユーザーID</th>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">作成日</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            {#each facilities as f}
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-medium text-gray-900">{f.name}</td>
                <td class="px-6 py-4 text-gray-600 font-mono text-sm">{f.username}</td>
                <td class="px-6 py-4 text-gray-400 text-sm">{new Date(f.createdAt).toLocaleDateString('ja-JP')}</td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-3">
                    <button onclick={() => { editPasswordId = f.id; newPassword = ''; }}
                      class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">PW変更</button>
                    {#if f.id !== 'default'}
                      <button onclick={() => deleteFacility(f.id, f.name)}
                        class="text-sm text-red-500 hover:text-red-700 font-medium">削除</button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</div>

<!-- 施設追加モーダル -->
{#if showModal}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-5">施設を追加</h3>
      <form onsubmit={(e) => { e.preventDefault(); createFacility(); }} class="space-y-4">
        <div>
          <label for="admin-facility-name" class="block text-sm font-medium text-gray-700 mb-1">施設名 <span class="text-red-500">*</span></label>
          <input id="admin-facility-name" bind:value={form.name} required type="text" placeholder="例: 渋谷店"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div>
          <label for="admin-facility-username" class="block text-sm font-medium text-gray-700 mb-1">ユーザーID <span class="text-red-500">*</span></label>
          <input id="admin-facility-username" bind:value={form.username} required type="text" placeholder="例: shibuya"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          <p class="text-xs text-gray-400 mt-1">施設スタッフがログイン時に使用するIDです</p>
        </div>
        <div>
          <label for="admin-facility-password" class="block text-sm font-medium text-gray-700 mb-1">パスワード <span class="text-red-500">*</span></label>
          <input id="admin-facility-password" bind:value={form.password} required type="text"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          <p class="text-xs text-gray-400 mt-1">施設スタッフに共有するパスワードです</p>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick={() => showModal = false}
            class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">キャンセル</button>
          <button type="submit" disabled={loading}
            class="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {loading ? '追加中...' : '追加'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- パスワード変更モーダル -->
{#if editPasswordId}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">パスワード変更</h3>
      <div class="space-y-4">
        <div>
          <label for="admin-new-password" class="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
          <input id="admin-new-password" bind:value={newPassword} type="text"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        </div>
        <div class="flex gap-3">
          <button onclick={() => editPasswordId = null}
            class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">キャンセル</button>
          <button onclick={changePassword} disabled={loading || !newPassword}
            class="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {loading ? '変更中...' : '変更'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
