<script lang="ts">
	import type { MatchEvent, ViewMode } from '$lib/types.js';
	import {
		getF1EffectiveAdvantages,
		getF1EffectivePoints,
		getF2EffectiveAdvantages,
		getF2EffectivePoints,
		getLeader,
		getWinMethod,
		getWinner,
		isMatchPaused
	} from '$lib/scoring.js';
	import { sanitizeColor } from '$lib/colors.js';
	import { t } from '$lib/i18n/index.js';
	import StatusBadge from './StatusBadge.svelte';
	import Timer from './Timer.svelte';
	import { base } from '$app/paths';

	interface Props {
		match: MatchEvent;
		mode: ViewMode;
	}

	let { match, mode }: Props = $props();

	// The effective score: a penalty against the opponent has already become
	// points, and this is what the referee's own screen shows.
	let f1Score = $derived(getF1EffectivePoints(match));
	let f2Score = $derived(getF2EffectivePoints(match));
	let f1Adv = $derived(getF1EffectiveAdvantages(match));
	let f2Adv = $derived(getF2EffectiveAdvantages(match));

	// Who to light up. A finished match names its winner, and that name is the
	// only thing worth believing: a fighter can lead 4–0 and lose to an armbar,
	// and every number on this card will still favour the loser. Only an
	// undecided match lets the scoreboard speak for itself.
	let leader = $derived(
		match.status === 'finished' ? getWinner(match) : getLeader(match)
	);
	let outcome = $derived(match.method ? getWinMethod(match) : null);
	let isCanceled = $derived(match.status === 'canceled');
	let isLive = $derived(match.status === 'in-progress');
	let isPaused = $derived(isMatchPaused(match));
	let isFinished = $derived(match.status === 'finished');
	let isBroadcast = $derived(mode === 'broadcast');

	let f1Color = $derived(sanitizeColor(match.f1_color, '#2563eb'));
	let f2Color = $derived(sanitizeColor(match.f2_color, '#dc2626'));
</script>

<a
	href="{base}/match/{match.id}"
	class="block rounded-xl border transition-all duration-200 no-underline hover:scale-[1.01] {isLive ? 'animate-glow-green' : ''} {isCanceled ? 'opacity-50' : ''}"
	style="background-color: var(--bg-card); border-color: {isLive ? 'var(--color-green-live)' : 'var(--border-color)'};"
>
	<!-- Status & Timer Row -->
	<div class="flex items-center justify-between px-4 pt-3 {isBroadcast ? 'px-6 pt-4' : ''}">
		<StatusBadge status={match.status} paused={isPaused} />
		<Timer {match} />
	</div>

	<!-- Fighters -->
	<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 {isBroadcast ? 'gap-4 p-6' : ''}">
		<!-- Fighter 1 -->
		<div class="text-center">
			<div
				class="mx-auto mb-2 h-1.5 w-16 rounded-full {isBroadcast ? 'h-2 w-24' : ''}"
				style="background-color: {f1Color};"
			></div>
			<p class="truncate font-semibold {isBroadcast ? 'text-lg' : 'text-sm'}" style="color: var(--text-primary);">
				{match.f1_name}
			</p>
			<div class="mt-1 flex items-center justify-center gap-1">
				<span
					class="font-mono font-extrabold {isBroadcast ? 'text-5xl' : 'text-3xl'} {leader === 1 && (isLive || isFinished) ? 'animate-pulse-live' : ''}"
					style="color: var(--text-primary);"
				>
					{f1Score}
				</span>
				{#if isFinished && leader === 1}
					<span class="animate-bounce text-lg">🏆</span>
				{/if}
			</div>
			<!-- Adv & Pen -->
			<div class="mt-1 flex justify-center gap-2 text-xs font-medium">
				{#if f1Adv > 0}
					<span class="rounded px-1.5 py-0.5" style="background-color: var(--color-gold, #F5B800); color: #000;">
						{$t('score.advantageShort')} {f1Adv}
					</span>
				{/if}
				{#if match.f1_pen > 0}
					<span class="rounded px-1.5 py-0.5 text-white" style="background-color: var(--color-red-penalty, #C0392B);">
						{$t('score.penaltyShort')} {match.f1_pen}
					</span>
				{/if}
			</div>
		</div>

		<!-- VS divider -->
		<div class="text-center font-bold" style="color: var(--text-secondary);">
			<span class="{isBroadcast ? 'text-xl' : 'text-sm'}">{$t('score.vs')}</span>
		</div>

		<!-- Fighter 2 -->
		<div class="text-center">
			<div
				class="mx-auto mb-2 h-1.5 w-16 rounded-full {isBroadcast ? 'h-2 w-24' : ''}"
				style="background-color: {f2Color};"
			></div>
			<p class="truncate font-semibold {isBroadcast ? 'text-lg' : 'text-sm'}" style="color: var(--text-primary);">
				{match.f2_name}
			</p>
			<div class="mt-1 flex items-center justify-center gap-1">
				<span
					class="font-mono font-extrabold {isBroadcast ? 'text-5xl' : 'text-3xl'} {leader === 2 && (isLive || isFinished) ? 'animate-pulse-live' : ''}"
					style="color: var(--text-primary);"
				>
					{f2Score}
				</span>
				{#if isFinished && leader === 2}
					<span class="animate-bounce text-lg">🏆</span>
				{/if}
			</div>
			<!-- Adv & Pen -->
			<div class="mt-1 flex justify-center gap-2 text-xs font-medium">
				{#if f2Adv > 0}
					<span class="rounded px-1.5 py-0.5" style="background-color: var(--color-gold, #F5B800); color: #000;">
						{$t('score.advantageShort')} {f2Adv}
					</span>
				{/if}
				{#if match.f2_pen > 0}
					<span class="rounded px-1.5 py-0.5 text-white" style="background-color: var(--color-red-penalty, #C0392B);">
						{$t('score.penaltyShort')} {match.f2_pen}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- How it ended. The score row above cannot say: a match won by submission
	     shows the loser's numbers as the bigger ones. -->
	{#if outcome}
		<div class="border-t px-6 py-2 text-center" style="border-color: var(--border-color);">
			<span class="text-xs font-bold tracking-wide" style="color: var(--color-gold, #F5B800);">
				{outcome.method}
			</span>
			<span class="ml-2 text-xs" style="color: var(--text-secondary);">
				{outcome.detail}
			</span>
		</div>
	{/if}

	<!-- Point breakdown (broadcast mode) -->
	{#if isBroadcast}
		<div class="border-t px-6 py-3" style="border-color: var(--border-color);">
			<div class="grid grid-cols-[1fr_auto_1fr] gap-4 text-center text-xs" style="color: var(--text-secondary);">
				<div class="flex justify-center gap-3">
					<span>{$t('score.pt2.card')} {match.f1_pt2}</span>
					<span>{$t('score.pt3.card')} {match.f1_pt3}</span>
					<span>{$t('score.pt4.card')} {match.f1_pt4}</span>
				</div>
				<span>{$t('score.points')}</span>
				<div class="flex justify-center gap-3">
					<span>{$t('score.pt2.card')} {match.f2_pt2}</span>
					<span>{$t('score.pt3.card')} {match.f2_pt3}</span>
					<span>{$t('score.pt4.card')} {match.f2_pt4}</span>
				</div>
			</div>
		</div>
	{/if}
</a>
