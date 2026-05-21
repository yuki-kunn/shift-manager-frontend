<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { employees, businessHours, auth } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let { children } = $props();

  const publicRoutes = ['/login', '/admin'];
  $effect(() => {
    const path = $page.url.pathname;
    const isPublic = publicRoutes.some(r => path.startsWith(r));
    if (!isPublic && (!$auth || $auth.role !== 'facility')) {
      goto('/login');
    }
  });

  onMount(async () => {
    if (!$auth || $auth.role !== 'facility') return;
    try {
      const [emps, bh] = await Promise.all([api.employees.list(), api.settings.getBusinessHours()]);
      employees.set(emps);
      businessHours.set(bh);
    } catch (e) { console.error('Init failed:', e); }
  });

  let isAppRoute = $derived(!publicRoutes.some(r => $page.url.pathname.startsWith(r)));
</script>

{#if isAppRoute && $auth?.role === 'facility'}
  <div class="flex">
    <Sidebar />
    <main class="ml-64 flex-1 min-h-screen bg-gray-50">
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}
<Toast />
