<script lang="ts">
	import PubkeyInput from '../components/PubkeyInput.svelte';
	import MatchCard from '../components/MatchCard.svelte';
	import { matchesMap, viewMode, isLoading, activePubkey, getSortedMatches } from '$lib/stores.js';
	import { MATCH_AGE_CHECK_INTERVAL_MS } from '$lib/constants.js';
	import { t } from '$lib/i18n/index.js';
	import type { MatchEvent, ViewMode } from '$lib/types.js';

	let allMatches = $state<Map<string, MatchEvent>>(new Map());
	let nowSeconds = $state(Math.floor(Date.now() / 1000));
	let loading = $state(false);
	let connected = $state(false);
	let currentViewMode = $state<ViewMode>('compact');

	let matches = $derived(getSortedMatches(allMatches, nowSeconds));

	$effect(() => {
		const unsub = matchesMap.subscribe((map) => {
			allMatches = map;
		});
		return unsub;
	});

	// Advance the clock so matches drop off the list once they pass the age limit
	$effect(() => {
		const id = setInterval(() => {
			nowSeconds = Math.floor(Date.now() / 1000);
		}, MATCH_AGE_CHECK_INTERVAL_MS);
		return () => clearInterval(id);
	});

	$effect(() => {
		const unsub = isLoading.subscribe((v) => {
			loading = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = activePubkey.subscribe((pk) => {
			connected = pk !== '';
		});
		return unsub;
	});

	$effect(() => {
		const unsub = viewMode.subscribe((v) => {
			currentViewMode = v;
		});
		return unsub;
	});

	function toggleViewMode(): void {
		viewMode.update((v) => (v === 'compact' ? 'broadcast' : 'compact'));
	}
</script>

<svelte:head>
	<title>{$t('title.home')}</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6 px-4 py-6">
	<PubkeyInput />

	{#if connected}
		<!-- View mode toggle -->
		<div class="flex items-center justify-between">
			<p class="text-sm" style="color: var(--text-secondary);">
				{$t('home.matchCount', matches.length)}
			</p>
			<button
				onclick={toggleViewMode}
				class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
				style="background-color: var(--bg-input); color: var(--text-secondary);"
			>
				{currentViewMode === 'compact' ? $t('home.viewBroadcast') : $t('home.viewCompact')}
			</button>
		</div>

		{#if loading}
			<!-- Loading spinner -->
			<div class="flex flex-col items-center justify-center py-16">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style="border-color: var(--border-color); border-top-color: var(--color-green-live);"></div>
				<p class="mt-4 text-sm" style="color: var(--text-secondary);">{$t('home.connecting')}</p>
			</div>
		{:else if matches.length === 0}
			<!-- Empty state -->
			<div class="flex flex-col items-center justify-center py-16">
				<span class="text-5xl">🥋</span>
				<p class="mt-4 text-lg font-medium" style="color: var(--text-secondary);">{$t('home.emptyTitle')}</p>
				<p class="mt-1 text-sm" style="color: var(--text-secondary);">
					{$t('home.emptyBody')}
				</p>
			</div>
		{:else}
			<!-- Match list -->
			<div class="grid gap-4 {currentViewMode === 'broadcast' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}">
				{#each matches as match (match.id)}
					<MatchCard {match} mode={currentViewMode} />
				{/each}
			</div>
		{/if}
	{:else}
		<!-- Welcome state -->
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<span class="text-6xl">🥋</span>
			<h2 class="mt-4 text-2xl font-bold" style="color: var(--text-primary);">{$t('home.welcomeTitle')}</h2>
			<p class="mt-2 max-w-md text-sm" style="color: var(--text-secondary);">
				{$t('home.welcomeBody')}
			</p>
		</div>
	{/if}
</div>
