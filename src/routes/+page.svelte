<script lang="ts">
	import PubkeyInput from '../components/PubkeyInput.svelte';
	import MatchCard from '../components/MatchCard.svelte';
	import StatusFilter from '../components/StatusFilter.svelte';
	import {
		matchesMap,
		viewMode,
		isLoading,
		activePubkey,
		statusFilter,
		getSortedMatches
	} from '$lib/stores.js';
	import { MATCH_AGE_CHECK_INTERVAL_MS } from '$lib/constants.js';
	import { t } from '$lib/i18n/index.js';
	import { base } from '$app/paths';
	import type { MatchEvent, MatchStatus, ViewMode } from '$lib/types.js';

	let allMatches = $state<Map<string, MatchEvent>>(new Map());
	let nowSeconds = $state(Math.floor(Date.now() / 1000));
	let loading = $state(false);
	let connected = $state(false);
	let currentViewMode = $state<ViewMode>('compact');
	let allowedStatuses = $state<Set<MatchStatus>>(new Set($statusFilter));

	let matches = $derived(getSortedMatches(allMatches, nowSeconds, allowedStatuses));
	// Fresh matches regardless of the status filter. When this is > 0 but `matches`
	// is empty, the list is empty because the chips hid everything — not because no
	// events arrived, which is a different (and misleading) message.
	let freshCount = $derived(getSortedMatches(allMatches, nowSeconds).length);

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

	$effect(() => {
		const unsub = statusFilter.subscribe((s) => {
			allowedStatuses = s;
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

<div class="mx-auto max-w-6xl" style="padding: 26px 30px 40px;">
	<PubkeyInput />

	{#if connected}
		<!-- Toolbar: the big count and the broadcast toggle (design 2A) -->
		<div class="flex items-center justify-between" style="margin-top: 24px;">
			<div class="flex items-baseline" style="gap: 10px;">
				<span
					style="font-family: 'Archivo', system-ui, sans-serif; font-weight: 800; font-size: 34px; line-height: 1; color: var(--text-primary);"
					>{matches.length}</span
				>
				<span
					class="uppercase"
					style="font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 600; font-size: 20px; line-height: 1; letter-spacing: .14em; color: #6b7890;"
					>{$t('home.matchesWord', matches.length)}</span
				>
			</div>
			<button
				onclick={toggleViewMode}
				class="inline-flex cursor-pointer items-center transition-opacity hover:opacity-90"
				style="gap: 9px; padding: 11px 20px; border-radius: 11px; background: linear-gradient(135deg, #a855f7, #7c3aed); border: none; font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 700; font-size: 17px; letter-spacing: .04em; color: #fff; box-shadow: 0 8px 22px rgba(124,58,237,.4);"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="#fff"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<rect x="2" y="7" width="20" height="14" rx="2" />
					<path d="m17 2-5 5-5-5" />
				</svg>
				{currentViewMode === 'compact' ? $t('home.viewBroadcast') : $t('home.viewCompact')}
			</button>
		</div>

		<!-- Status filter -->
		<div style="margin-top: 18px;">
			<StatusFilter />
		</div>

		{#if loading}
			<!-- Loading spinner -->
			<div class="flex flex-col items-center justify-center py-16">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style="border-color: var(--border-color); border-top-color: var(--color-green-live);"></div>
				<p class="mt-4 text-sm" style="color: var(--text-secondary);">{$t('home.connecting')}</p>
			</div>
		{:else if matches.length === 0 && freshCount > 0}
			<!-- Filtered-empty state: matches exist but the status filter hides them all -->
			<div class="flex flex-col items-center justify-center py-16">
				<svg
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="var(--text-secondary)"
					stroke-width="1.5"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<circle cx="11" cy="11" r="7" />
					<path d="m20 20-3.5-3.5" />
				</svg>
				<p class="mt-4 text-lg font-medium" style="color: var(--text-secondary);">{$t('home.filterEmptyTitle')}</p>
				<p class="mt-1 text-sm" style="color: var(--text-secondary);">
					{$t('home.filterEmptyBody')}
				</p>
			</div>
		{:else if matches.length === 0}
			<!-- Empty state -->
			<div class="flex flex-col items-center justify-center py-16">
				<img
					src="{base}/choke.png"
					alt=""
					width="56"
					height="56"
					style="width: 56px; height: 56px; border-radius: 14px; object-fit: cover; opacity: .85;"
				/>
				<p class="mt-4 text-lg font-medium" style="color: var(--text-secondary);">{$t('home.emptyTitle')}</p>
				<p class="mt-1 text-sm" style="color: var(--text-secondary);">
					{$t('home.emptyBody')}
				</p>
			</div>
		{:else}
			<!-- Match list -->
			<div
				class="grid {currentViewMode === 'broadcast' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}"
				style="gap: 18px; margin-top: 24px;"
			>
				{#each matches as match (match.id)}
					<MatchCard {match} mode={currentViewMode} />
				{/each}
			</div>
		{/if}
	{:else}
		<!-- Welcome state -->
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<img
				src="{base}/choke.png"
				alt=""
				width="72"
				height="72"
				style="width: 72px; height: 72px; border-radius: 18px; object-fit: cover; border: 1px solid var(--pill-border); box-shadow: 0 0 32px rgba(168,85,247,.3);"
			/>
			<h2 class="mt-4 text-2xl font-bold" style="color: var(--text-primary);">{$t('home.welcomeTitle')}</h2>
			<p class="mt-2 max-w-md text-sm" style="color: var(--text-secondary);">
				{$t('home.welcomeBody')}
			</p>
		</div>
	{/if}
</div>
