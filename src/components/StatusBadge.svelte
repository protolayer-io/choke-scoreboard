<script lang="ts">
	import type { MatchStatus } from '$lib/types.js';

	interface Props {
		status: MatchStatus;
		/** Whether the referee has the clock stopped. A paused match is still 'in-progress'. */
		paused?: boolean;
	}

	let { status, paused = false }: Props = $props();
</script>

{#if status === 'in-progress' && paused}
	<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-400">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
			<rect x="6" y="5" width="4" height="14" rx="1" />
			<rect x="14" y="5" width="4" height="14" rx="1" />
		</svg>
		PAUSED
	</span>
{:else if status === 'waiting'}
	<span class="inline-flex items-center gap-1 rounded-full bg-gray-500/20 px-2.5 py-0.5 text-xs font-medium text-gray-400">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
		WAITING
	</span>
{:else if status === 'in-progress'}
	<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style="background-color: var(--color-green-live, #1BA34E);">
		<span class="relative flex h-2 w-2">
			<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
			<span class="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
		</span>
		LIVE
	</span>
{:else if status === 'finished'}
	<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
		<span class="animate-bounce">🏆</span>
		FINISHED
	</span>
{:else}
	<span class="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
		CANCELED
	</span>
{/if}
