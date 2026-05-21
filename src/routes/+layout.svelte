<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { employees, businessHours } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(async () => {
    try {
      const [emps, bh] = await Promise.all([api.employees.list(), api.settings.getBusinessHours()]);
      employees.set(emps);
      businessHours.set(bh);
    } catch (e) { console.error('Init failed:', e); }
  });
</script>

<div class="flex">
  <Sidebar />
  <main class="ml-64 flex-1 min-h-screen bg-gray-50">
    {@render children()}
  </main>
</div>
<Toast />
