<script lang="ts">
  import { authApi } from '$lib/api.js';
  import { auth, showToast } from '$lib/stores.js';
  import { goto } from '$app/navigation';

  let mode = $state<'facility' | 'admin'>('facility');
  let username = $state('');
  let password = $state('');
  let loading = $state(false);

  async function login() {
    loading = true;
    try {
      if (mode === 'admin') {
        const res = await authApi.adminLogin(username, password);
        auth.set({ token: res.token, role: 'admin' });
        goto('/admin');
      } else {
        const res = await authApi.facilityLogin(username, password);
        auth.set({ token: res.token, role: 'facility', facilityId: res.facilityId, facilityName: res.facilityName });
        goto('/');
      }
    } catch (e: any) {
      showToast(e?.error ?? 'ログインに失敗しました', 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">
    <div class="flex items-center gap-3 mb-8">
      <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      </div>
      <div>
        <h1 class="text-xl font-bold text-gray-900">Shift Manager</h1>
        <p class="text-xs text-gray-400">シフト管理システム</p>
      </div>
    </div>

    <!-- モード切替 -->
    <div class="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
      <button onclick={() => mode = 'facility'}
        class="flex-1 py-2 rounded-lg text-sm font-medium transition-all {mode === 'facility' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">
        施設ログイン
      </button>
      <button onclick={() => mode = 'admin'}
        class="flex-1 py-2 rounded-lg text-sm font-medium transition-all {mode === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">
        管理者ログイン
      </button>
    </div>

    <form onsubmit={(e) => { e.preventDefault(); login(); }} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">ユーザーID</label>
        <input bind:value={username} type="text" required autocomplete="username"
          placeholder={mode === 'admin' ? 'admin' : '施設のユーザーID'}
          class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
        <input bind:value={password} type="password" required autocomplete="current-password"
          class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
      </div>
      <button type="submit" disabled={loading}
        class="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-all mt-2">
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  </div>
</div>
