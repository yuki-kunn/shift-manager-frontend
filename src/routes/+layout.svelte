<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { employees, businessHours, employeeTypes, facilitySettings, auth } from '$lib/stores.js';
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
    const results = await Promise.allSettled([
      api.employees.list(),
      api.settings.getBusinessHours(),
      api.settings.listEmployeeTypes(),
      api.settings.getFacilitySettings(),
    ]);
    if (results[0].status === 'fulfilled') employees.set(results[0].value);
    else console.error('employees.list failed:', results[0].reason);
    if (results[1].status === 'fulfilled') businessHours.set(results[1].value);
    else console.error('getBusinessHours failed:', results[1].reason);
    if (results[2].status === 'fulfilled') employeeTypes.set(results[2].value);
    else console.error('listEmployeeTypes failed:', results[2].reason);
    if (results[3].status === 'fulfilled') facilitySettings.set(results[3].value);
    else console.error('getFacilitySettings failed:', results[3].reason);
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
