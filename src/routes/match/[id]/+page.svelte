<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { matchesMap } from '$lib/stores.js';
	import { getF1Score, getF2Score, getLeader, getWinMethod } from '$lib/scoring.js';
	import { alpha, sanitizeColor } from '$lib/colors.js';
	import Timer from '../../../components/Timer.svelte';
	import type { MatchEvent } from '$lib/types.js';

	const DEFAULT_F1_COLOR = '#13c88a';
	const DEFAULT_F2_COLOR = '#ff9f33';

	const STATUS_STYLES = {
		waiting: { label: 'WAITING', color: '#8a97b2', dot: '#8a97b2' },
		'in-progress': { label: 'LIVE', color: '#2ee08a', dot: '#16c05f' },
		finished: { label: 'FINAL', color: '#ffffff', dot: '#ffffff' },
		canceled: { label: 'CANCELED', color: '#f87171', dot: '#ef4444' }
	} as const;

	let matchId = $derived($page.params.id ?? '');
	let match = $derived<MatchEvent | undefined>($matchesMap.get(matchId));

	let f1Score = $derived(match ? getF1Score(match) : 0);
	let f2Score = $derived(match ? getF2Score(match) : 0);

	let isLive = $derived(match?.status === 'in-progress');
	let isFinal = $derived(match?.status === 'finished');
	let showTimer = $derived(match?.status === 'waiting' || isLive);

	/** 1 = fighter 1 won, 2 = fighter 2 won, 0 = draw or not finished. */
	let winner = $derived(match && isFinal ? getLeader(match) : 0);
	let result = $derived(match && isFinal ? getWinMethod(match) : null);

	let f1Color = $derived(sanitizeColor(match?.f1_color, DEFAULT_F1_COLOR));
	let f2Color = $derived(sanitizeColor(match?.f2_color, DEFAULT_F2_COLOR));
	let winnerColor = $derived(winner === 1 ? f1Color : winner === 2 ? f2Color : '#ffffff');

	let status = $derived(STATUS_STYLES[match?.status ?? 'waiting']);
	let statusColor = $derived(isFinal ? winnerColor : status.color);
	let statusDot = $derived(isFinal ? winnerColor : status.dot);

	let isFullscreen = $state(false);

	/** Diagonal color wash behind a half, fading out toward the center. */
	function halfBackground(color: string, angle: number): string {
		return `linear-gradient(${angle}deg, ${alpha(color, 0.3)}, ${alpha(color, 0.05)} 55%, transparent 78%)`;
	}

	async function toggleFullscreen(): Promise<void> {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await document.documentElement.requestFullscreen();
			}
		} catch (err) {
			// Browsers reject this outside a user gesture or when the API is blocked.
			// The view already fills the viewport, so degrade quietly.
			console.warn('Fullscreen request rejected:', err);
		}
	}

	$effect(() => {
		const onChange = () => (isFullscreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	});
</script>

<svelte:head>
	<title>{match ? `${match.f1_name} vs ${match.f2_name}` : 'Match'} — Choke Scoreboard</title>
</svelte:head>

{#if match}
	<div
		class="relative h-full w-full overflow-hidden"
		style="background:#05070e;font-family:'Barlow Condensed',system-ui,sans-serif"
	>
		<!-- Color wash per half -->
		<div class="absolute inset-y-0 left-0 w-1/2" style="background:{halfBackground(f1Color, 100)}"></div>
		<div class="absolute inset-y-0 right-0 w-1/2" style="background:{halfBackground(f2Color, 260)}"></div>

		<!-- Edge bars -->
		<div
			class="absolute inset-y-0 left-0 w-[11px]"
			style="background:{f1Color};box-shadow:0 0 50px {alpha(f1Color, 0.6)}"
		></div>
		<div
			class="absolute inset-y-0 right-0 w-[11px]"
			style="background:{f2Color};box-shadow:0 0 50px {alpha(f2Color, 0.6)}"
		></div>

		<!-- Fighter 1 (left) -->
		<div
			class="absolute inset-y-0 left-0 box-border flex w-1/2 flex-col items-center py-[5vh] pr-[16vw] pl-[3vw] md:px-[4vw]"
		>
			<div class="flex w-full min-w-0 items-center justify-center gap-[0.8vw]">
				<span
					class="h-[1.7vw] max-h-6 min-h-3 w-[1.7vw] max-w-6 min-w-3 shrink-0 rounded-md"
					style="background:{f1Color};box-shadow:0 0 20px {alpha(f1Color, 0.6)}"
				></span>
				<span
					class="truncate font-extrabold tracking-wide text-white uppercase"
					style="font-size:clamp(0.9rem,3.2vw,58px);line-height:1.1"
				>
					{match.f1_name}
				</span>
			</div>

			<div class="flex flex-1 items-center justify-center">
				{#key f1Score}
					<div
						class="animate-scorepop font-black text-white"
						style="font-family:'Archivo',system-ui,sans-serif;font-size:clamp(4rem,13vw,232px);line-height:1;text-shadow:0 0 55px {alpha(f1Color, 0.6)}"
					>
						{f1Score}
					</div>
				{/key}
			</div>

			<div class="flex flex-col items-center gap-[2vh]">
				<div class="flex gap-[2vw]">
					{#each [['2 PTS', match.f1_pt2], ['3 PTS', match.f1_pt3], ['4 PTS', match.f1_pt4]] as [label, value] (label)}
						<div class="text-center">
							<div class="font-bold tracking-[0.16em]" style="color:#5f6d8a;font-size:clamp(0.6rem,1vw,19px)">
								{label}
							</div>
							<div class="mt-2 font-extrabold text-white" style="font-size:clamp(1.1rem,1.9vw,36px);line-height:1">
								{value}
							</div>
						</div>
					{/each}
				</div>
				<div class="flex gap-[0.7vw]">
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:rgba(244,180,0,.14);border:1px solid rgba(244,180,0,.45)"
					>
						<span class="font-bold tracking-[0.1em]" style="color:#f4b400;font-size:clamp(0.75rem,1.25vw,24px)">ADV</span>
						<span class="font-extrabold" style="color:#ffd451;font-size:clamp(0.85rem,1.4vw,27px)">{match.f1_adv}</span>
					</div>
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.5)"
					>
						<span class="font-bold tracking-[0.1em]" style="color:#f87171;font-size:clamp(0.75rem,1.25vw,24px)">PEN</span>
						<span class="font-extrabold" style="color:#fca5a5;font-size:clamp(0.85rem,1.4vw,27px)">{match.f1_pen}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Fighter 2 (right) -->
		<div
			class="absolute inset-y-0 right-0 box-border flex w-1/2 flex-col items-center py-[5vh] pr-[3vw] pl-[16vw] md:px-[4vw]"
		>
			<div class="flex w-full min-w-0 items-center justify-center gap-[0.8vw]">
				<span
					class="h-[1.7vw] max-h-6 min-h-3 w-[1.7vw] max-w-6 min-w-3 shrink-0 rounded-md"
					style="background:{f2Color};box-shadow:0 0 20px {alpha(f2Color, 0.6)}"
				></span>
				<span
					class="truncate font-extrabold tracking-wide text-white uppercase"
					style="font-size:clamp(0.9rem,3.2vw,58px);line-height:1.1"
				>
					{match.f2_name}
				</span>
			</div>

			<div class="flex flex-1 items-center justify-center">
				{#key f2Score}
					<div
						class="animate-scorepop font-black text-white"
						style="font-family:'Archivo',system-ui,sans-serif;font-size:clamp(4rem,13vw,232px);line-height:1;text-shadow:0 0 55px {alpha(f2Color, 0.6)}"
					>
						{f2Score}
					</div>
				{/key}
			</div>

			<div class="flex flex-col items-center gap-[2vh]">
				<div class="flex gap-[2vw]">
					{#each [['2 PTS', match.f2_pt2], ['3 PTS', match.f2_pt3], ['4 PTS', match.f2_pt4]] as [label, value] (label)}
						<div class="text-center">
							<div class="font-bold tracking-[0.16em]" style="color:#5f6d8a;font-size:clamp(0.6rem,1vw,19px)">
								{label}
							</div>
							<div class="mt-2 font-extrabold text-white" style="font-size:clamp(1.1rem,1.9vw,36px);line-height:1">
								{value}
							</div>
						</div>
					{/each}
				</div>
				<div class="flex gap-[0.7vw]">
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:rgba(244,180,0,.14);border:1px solid rgba(244,180,0,.45)"
					>
						<span class="font-bold tracking-[0.1em]" style="color:#f4b400;font-size:clamp(0.75rem,1.25vw,24px)">ADV</span>
						<span class="font-extrabold" style="color:#ffd451;font-size:clamp(0.85rem,1.4vw,27px)">{match.f2_adv}</span>
					</div>
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.5)"
					>
						<span class="font-bold tracking-[0.1em]" style="color:#f87171;font-size:clamp(0.75rem,1.25vw,24px)">PEN</span>
						<span class="font-extrabold" style="color:#fca5a5;font-size:clamp(0.85rem,1.4vw,27px)">{match.f2_pen}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Dim the loser's half -->
		{#if winner === 2}
			<div class="absolute inset-y-0 left-0 z-[4] w-1/2" style="background:rgba(5,7,14,.62)"></div>
		{:else if winner === 1}
			<div class="absolute inset-y-0 right-0 z-[4] w-1/2" style="background:rgba(5,7,14,.62)"></div>
		{/if}

		<!-- Center column: status, timer, VS -->
		<div
			class="absolute inset-y-0 left-1/2 z-[5] flex w-[28vw] max-w-[360px] -translate-x-1/2 flex-col items-center py-[5vh]"
		>
			<div
				class="inline-flex items-center gap-2 rounded-full px-[1.2vw] py-[1vh]"
				style="background:{alpha(statusColor, 0.12)};border:1px solid {alpha(statusColor, 0.5)}"
			>
				<span
					class="h-3 w-3 shrink-0 rounded-full {isLive ? 'animate-liveblink' : ''}"
					style="background:{statusDot};box-shadow:0 0 14px {statusDot}"
				></span>
				<span
					class="font-bold tracking-[0.16em] whitespace-nowrap"
					style="color:{statusColor};font-size:clamp(0.7rem,1.25vw,24px)"
				>
					{status.label}
				</span>
			</div>

			<div class="flex flex-1 flex-col items-center justify-center gap-5">
				{#if showTimer}
					<div
						class="flex flex-col items-center gap-3 rounded-[18px] px-[1.8vw] py-[2.5vh]"
						style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);box-shadow:0 0 60px rgba(0,0,0,.45)"
					>
						<span class="font-bold tracking-[0.3em]" style="color:#5f6d8a;font-size:clamp(0.55rem,0.9vw,17px)">
							TIME
						</span>
						<Timer {match} tone="bright" class="text-[clamp(2.5rem,5.2vw,76px)] leading-none" />
					</div>
					<div
						class="font-extrabold tracking-[0.14em]"
						style="color:rgba(255,255,255,.16);font-size:clamp(1rem,1.7vw,32px)"
					>
						VS
					</div>
				{/if}
			</div>
		</div>

		<!-- Winner banner -->
		{#if isFinal && result}
			<div
				class="animate-sweep-in absolute top-1/2 left-1/2 z-[6] flex max-w-[86vw] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-3xl px-[3vw] py-[3vh] text-center backdrop-blur-sm"
				style="background:rgba(5,7,14,.72)"
			>
				<div class="font-bold tracking-[0.36em]" style="color:#8a97b2;font-size:clamp(0.7rem,1.25vw,24px)">
					{winner === 0 ? 'RESULT' : 'WINNER'}
				</div>
				{#if winner !== 0}
					<div
						class="font-extrabold uppercase"
						style="color:{winnerColor};font-size:clamp(2rem,6vw,86px);line-height:1;text-shadow:0 0 46px {alpha(winnerColor, 0.6)}"
					>
						{winner === 1 ? match.f1_name : match.f2_name}
					</div>
				{/if}
				<div
					class="rounded-xl px-[1.6vw] py-[1.4vh]"
					style="background:{alpha(winnerColor, 0.14)};border:1px solid {alpha(winnerColor, 0.5)}"
				>
					<span class="font-extrabold tracking-[0.12em]" style="color:{winnerColor};font-size:clamp(1rem,1.7vw,32px)">
						{result.method}
					</span>
				</div>
				<div class="font-semibold" style="color:#8a97b2;font-size:clamp(0.8rem,1.3vw,25px)">
					{result.detail}
				</div>
			</div>
		{/if}

		<!-- Overlay controls -->
		<a
			href="{base}/"
			class="absolute top-4 left-6 z-10 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-white/60 no-underline transition-colors hover:bg-white/10 hover:text-white"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6" />
			</svg>
			Back
		</a>

		<button
			type="button"
			onclick={toggleFullscreen}
			class="absolute top-4 right-6 z-10 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
		>
			{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
		</button>
	</div>
{:else}
	<div class="flex h-full flex-col items-center justify-center text-center" style="background:#05070e">
		<span class="text-5xl">🤷</span>
		<p class="mt-4 text-lg font-medium" style="color: var(--text-secondary);">Match not found</p>
		<p class="mt-1 text-sm" style="color: var(--text-secondary);">
			This match may not exist or hasn't been loaded yet.
		</p>
		<a href="{base}/" class="mt-6 text-sm underline" style="color: var(--color-green-live);">Back to scoreboard</a>
	</div>
{/if}
