<script lang="ts">
	import { onMount } from 'svelte';
	import PubkeyInput from '../components/PubkeyInput.svelte';
	import MatchCard from '../components/MatchCard.svelte';
	import MatchView from '../components/MatchView.svelte';
	import StatusFilter from '../components/StatusFilter.svelte';
	import {
		matchesMap,
		viewMode,
		isLoading,
		activePubkey,
		statusFilter,
		getSortedMatches,
		findMatchByOrganizer,
		relaysSettled,
		sharedMatchView
	} from '$lib/stores.js';
	import { MATCH_AGE_CHECK_INTERVAL_MS, MATCH_LINK_BACKSTOP_MS } from '$lib/constants.js';
	import { readSharedMatchLink, stripSharedLinkFromUrl } from '$lib/share-link.js';
	import { connectToPubkey } from '$lib/connect.js';
	import { decodePubkey } from '$lib/nostr.js';
	import { t } from '$lib/i18n/index.js';
	import { base } from '$app/paths';
	import type { MatchEvent, MatchStatus, ViewMode } from '$lib/types.js';

	/**
	 * ────────────────────────────────────────────────────────────────────────
	 * A shared match link resolves HERE, in place, and is not redirected to
	 * /match/<id>.
	 *
	 * Redirecting reads better and loses the link. The rule is that nothing is
	 * stripped until resolution completes, and that a refresh while still waiting
	 * re-applies the whole link — a navigation to /match/abcd breaks both at once:
	 * the id survives in the path but the organizer does not, so a refresh from
	 * there is a cold visit to a route with nothing subscribed, and the recipient
	 * gets an instant dead end for a match that was on its way. It would also
	 * leave nobody with anything to forward.
	 *
	 * Rendering in place costs one thing — two callers for the match view — and
	 * that was paid by extracting MatchView, which the route now renders too. No
	 * markup is duplicated.
	 * ────────────────────────────────────────────────────────────────────────
	 */

	// Read at setup and not in onMount, because it decides what to render on the
	// FIRST paint. A match link that showed the board for a frame before swapping
	// would be the silent substitution the whole design refuses, briefly.
	const link =
		typeof window !== 'undefined'
			? readSharedMatchLink(window.location.search)
			: ({ kind: 'none' } as const);

	// The viewer can leave — deliberately, never silently. Dismissing drops the
	// link and hands them the board they can already see the shape of.
	let dismissed = $state(false);
	let isMatchLink = $derived(link.kind !== 'none' && !dismissed);

	let organizerHex = $state('');
	let brokenKey = $state(false);
	let backstopFired = $state(false);

	$effect(() => {
		sharedMatchView.set(isMatchLink);
		return () => sharedMatchView.set(false);
	});

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

	// ─── Resolving the link ──────────────────────────────────────────────────

	onMount(() => {
		if (link.kind !== 'match') return;

		try {
			organizerHex = decodePubkey(link.pubkey);
		} catch {
			// A key that will not decode names no author, so there is nobody to ask
			// and nothing to wait for. That is a damaged URL, not a match that ended.
			brokenKey = true;
			return;
		}

		connectToPubkey(organizerHex);

		// The backstop, for the case where EOSE never comes. Its own timer and NOT
		// a second reader of `isLoading`: that store is cleared by EOSE and by the
		// subscription's own timeout alike, so watching it would end the wait on
		// whichever fired first with no way to know which — and knowing which is
		// exactly what tells "the relays do not have it" from "nobody answered".
		const backstop = setTimeout(() => {
			backstopFired = true;
		}, MATCH_LINK_BACKSTOP_MS);

		return () => clearTimeout(backstop);
	});

	let settled = $state(false);
	$effect(() => {
		const unsub = relaysSettled.subscribe((v) => {
			settled = v;
		});
		return unsub;
	});

	// (organizer, matchId), never matchId alone. An event carrying the same four
	// hex characters from a different author is somebody else's match that
	// collided in a 16-bit space; resolving to it would show one organizer's fight
	// to another organizer's guests.
	let linkedMatch = $derived<MatchEvent | undefined>(
		link.kind === 'match'
			? findMatchByOrganizer(allMatches, organizerHex, link.matchId, nowSeconds)
			: undefined
	);

	// Pending ends on EOSE-with-no-matching-event OR the backstop, whichever comes
	// first. Neither alone is sufficient.
	let isPending = $derived(!linkedMatch && !brokenKey && !settled && !backstopFired);

	let missing = $derived<'pending' | 'unresolved' | 'broken'>(
		link.kind === 'broken' || brokenKey ? 'broken' : isPending ? 'pending' : 'unresolved'
	);

	/**
	 * Strip once resolution completes, and not before.
	 *
	 * Both params go together or neither goes, and "when" matters as much: while
	 * Pending, the URL is the only place the match id exists — nothing persists it
	 * — so stripping early would throw away what a refresh, a reconnect or a late
	 * arrival still needs, and would leave `?match=…` without `?npub=…` in the bar
	 * for the whole wait. A refresh while Pending therefore re-applies the whole
	 * link, which is the wanted behaviour: another attempt at the thing they were
	 * sent, not a board they did not ask for.
	 *
	 * A broken link is already resolved — there was never anything to wait for.
	 */
	let stripped = false;
	$effect(() => {
		if (link.kind === 'none' || stripped) return;
		if (missing === 'pending') return;

		stripped = true;
		stripSharedLinkFromUrl();
	});

	/**
	 * Unresolved never becomes the board on its own.
	 *
	 * A late arrival still wins — `linkedMatch` keeps reading the store and the
	 * subscription outlives the backstop, so an event that turns up after the move
	 * to Unresolved resolves for free. What must never happen is the reverse: the
	 * viewer followed a link meant for one particular thing, and quietly showing
	 * them a different thing that looks like it worked is a lie they cannot catch.
	 * Leaving is a tap they take themselves.
	 */
	function dismissLink(): void {
		dismissed = true;
	}
</script>

<!--
	MatchView carries its own <title>, naming the two fighters. So this one steps
	aside while a link is on screen, rather than titling a named match with the
	list's name.
-->
<svelte:head>
	{#if !isMatchLink}
		<title>{$t('title.home')}</title>
	{/if}
</svelte:head>

{#if isMatchLink}
	<!-- The link's own view, full viewport. -->
	<MatchView match={linkedMatch} {missing} onExit={dismissLink} />
{:else}
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
{/if}
