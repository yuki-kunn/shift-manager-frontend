<script lang="ts">
  import { toast } from '$lib/stores.js';
</script>
{#if $toast}
  <div class="fixed bottom-4 right-4 z-50">
    <div class="rounded-xl px-4 py-3 shadow-lg text-white text-sm font-medium
      {$toast.type === 'success' ? 'bg-emerald-500' : $toast.type === 'error' ? 'bg-red-500' : 'bg-indigo-500'}">
      {$toast.message}
    </div>
  </div>
{/if}
