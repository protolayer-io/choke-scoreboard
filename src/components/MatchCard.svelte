<script lang="ts">
	import type { MatchEvent, MatchStatus, ViewMode } from '$lib/types.js';
	import {
		formatTime,
		getF1EffectiveAdvantages,
		getF1EffectivePoints,
		getF2EffectiveAdvantages,
		getF2EffectivePoints,
		getOutcome,
		getWinner,
		isMatchPaused
	} from '$lib/scoring.js';
	import { alpha, sanitizeColor } from '$lib/colors.js';
	import { t } from '$lib/i18n/index.js';
	import { formatOutcome } from '$lib/i18n/outcome.js';
	import Timer from './Timer.svelte';
	import { base } from '$app/paths';

	interface Props {
		match: MatchEvent;
		mode: ViewMode;
	}

	let { match, mode }: Props = $props();

	// The card's own status pill (design 2A). The KEYS of this map are wire
	// values and stay English forever; only the labels travel through $t.
	const STATUS_STYLES = {
		'in-progress': {
			label: 'status.live',
			color: '#2ee08a',
			dot: '#16c05f',
			bg: 'rgba(22,192,95,.14)',
			border: 'rgba(22,192,95,.5)',
			blink: true
		},
		waiting: {
			label: 'status.waiting',
			color: '#f4c453',
			dot: '#f4b400',
			bg: 'rgba(244,180,0,.12)',
			border: 'rgba(244,180,0,.4)',
			blink: false
		},
		finished: {
			label: 'status.finished',
			color: '#a7b2ce',
			dot: '#5f6d8a',
			bg: 'rgba(255,255,255,.05)',
			border: 'rgba(255,255,255,.12)',
			blink: false
		},
		canceled: {
			label: 'status.canceled',
			color: '#fca5a5',
			dot: '#ef4444',
			bg: 'rgba(239,68,68,.14)',
			border: 'rgba(239,68,68,.5)',
			blink: false
		}
	} as const satisfies Record<MatchStatus, object>;

	/** A paused match is still 'in-progress', so it has no status of its own to style. */
	const PAUSED_STYLE = {
		label: 'status.paused',
		color: '#f5b800',
		dot: '#f5b800',
		bg: 'rgba(245,184,0,.12)',
		border: 'rgba(245,184,0,.4)',
		blink: false
	} as const;

	// Defaults from the design's own palette, used when the event names none.
	const DEFAULT_F1_COLOR = '#13c88a';
	const DEFAULT_F2_COLOR = '#ff9f33';

	// The effective score: a penalty against the opponent has already become
	// points, and this is what the referee's own screen shows.
	let f1Score = $derived(getF1EffectivePoints(match));
	let f2Score = $derived(getF2EffectivePoints(match));
	let f1Adv = $derived(getF1EffectiveAdvantages(match));
	let f2Adv = $derived(getF2EffectiveAdvantages(match));

	let isCanceled = $derived(match.status === 'canceled');
	let isLive = $derived(match.status === 'in-progress');
	let isPaused = $derived(isMatchPaused(match));
	let isFinished = $derived(match.status === 'finished');
	let isBroadcast = $derived(mode === 'broadcast');

	// Who to light up. Only a finished match names its winner, and that name is
	// the only thing worth believing: a fighter can lead 4–0 and lose to an
	// armbar, and every number on this card will still favour the loser. While
	// the match runs, both sides stay bright (design 2A) — the card does not
	// guess.
	// getWinner() answers 0 for a draw (and for a stated method with no winner):
	// nobody won, so nobody dims. Only a real 1 or 2 turns the loser gray.
	let winner = $derived(isFinished ? getWinner(match) : 0);
	let decided = $derived(winner === 1 || winner === 2);

	// Keyed on the status, not on `method`: a legacy event that finished before
	// outcomes existed still gets its line.
	let outcome = $derived(isFinished ? formatOutcome($t, getOutcome(match)) : null);

	let f1Color = $derived(sanitizeColor(match.f1_color, DEFAULT_F1_COLOR));
	let f2Color = $derived(sanitizeColor(match.f2_color, DEFAULT_F2_COLOR));

	let pill = $derived(isLive && isPaused ? PAUSED_STYLE : STATUS_STYLES[match.status]);

	// Winner white, loser sunk into the background; undecided keeps both bright.
	// Literal white, not var(--text-primary): the card is dark in BOTH themes
	// (it is a scoreboard, like the broadcast view), so the token would paint
	// near-black text on a navy card the moment the light theme loaded.
	let f1NameColor = $derived(decided ? (winner === 1 ? '#ffffff' : '#66738f') : '#ffffff');
	let f2NameColor = $derived(decided ? (winner === 2 ? '#ffffff' : '#66738f') : '#ffffff');
	let f1ScoreColor = $derived(decided ? (winner === 1 ? f1Color : '#414d68') : '#ffffff');
	let f2ScoreColor = $derived(decided ? (winner === 2 ? f2Color : '#414d68') : '#ffffff');

	// The corner clock (design 2A): a finished card shows how long the match
	// was, a waiting or canceled one has nothing to say yet, and a live one
	// counts down via <Timer>.
	let cornerClock = $derived(isFinished ? formatTime(match.duration) : '--:--');
</script>

<a
	href="{base}/match/{match.id}"
	class="relative block overflow-hidden no-underline transition-transform duration-200 hover:scale-[1.01] {isCanceled
		? 'opacity-50'
		: ''}"
	style="border-radius: 16px; background: #0b1120; border: 1px solid rgba(255,255,255,.07); box-shadow: 0 10px 28px rgba(0,0,0,.35); font-family: 'Barlow Condensed', system-ui, sans-serif;"
>
	<!-- Per-fighter color washes and edge bars: the fighter's color is the
	     protagonist (design 2A). -->
	<div
		class="pointer-events-none absolute"
		style="inset: 0 50% 0 0; background: linear-gradient(100deg, {alpha(f1Color, 0.16)}, {alpha(f1Color, 0.02)} 60%, transparent 82%);"
	></div>
	<div
		class="pointer-events-none absolute"
		style="inset: 0 0 0 50%; background: linear-gradient(260deg, {alpha(f2Color, 0.16)}, {alpha(f2Color, 0.02)} 60%, transparent 82%);"
	></div>
	<div class="absolute top-0 bottom-0 left-0" style="width: 5px; background: {f1Color};"></div>
	<div class="absolute top-0 right-0 bottom-0" style="width: 5px; background: {f2Color};"></div>

	<!-- Status pill & corner clock -->
	<div class="relative flex items-center justify-between" style="padding: 16px 22px 4px;">
		<span
			class="inline-flex items-center"
			style="gap: 8px; padding: 5px 12px; border-radius: 999px; background: {pill.bg}; border: 1px solid {pill.border};"
		>
			<span
				class="rounded-full {pill.blink ? 'animate-liveblink' : ''}"
				style="width: 8px; height: 8px; background: {pill.dot};"
			></span>
			<span style="font-weight: 700; font-size: 13px; letter-spacing: .14em; color: {pill.color};"
				>{$t(pill.label)}</span
			>
		</span>
		<span
			style="font-family: 'Chakra Petch', monospace; font-weight: 600; font-size: 15px; letter-spacing: .06em; color: #4a5878; font-variant-numeric: tabular-nums; --text-secondary: #4a5878;"
		>
			{#if isLive}
				<Timer {match} class="text-[15px] font-semibold" />
			{:else}
				{cornerClock}
			{/if}
		</span>
	</div>

	<!-- Fighters -->
	<div
		class="relative grid grid-cols-[1fr_auto_1fr] items-start"
		style="gap: 12px; padding: 8px 22px 4px;"
	>
		<!-- Fighter 1 -->
		<div class="flex flex-col items-center text-center" style="gap: 8px;">
			<span style="width: 46px; height: 5px; border-radius: 3px; background: {f1Color};"></span>
			<span
				class="uppercase"
				style="font-weight: 700; font-size: 22px; line-height: 1; letter-spacing: .02em; color: {f1NameColor};"
				>{match.f1_name}</span
			>
			<span
				style="font-family: 'Archivo', system-ui, sans-serif; font-weight: 900; font-size: 52px; line-height: 1; color: {f1ScoreColor};"
				>{f1Score}</span
			>
			<div class="flex" style="gap: 6px; min-height: 24px;">
				{#if f1Adv > 0}
					<span
						class="whitespace-nowrap"
						style="padding: 3px 9px; border-radius: 7px; background: rgba(244,180,0,.16); border: 1px solid rgba(244,180,0,.45); font-weight: 700; font-size: 13px; letter-spacing: .08em; color: #f4c453;"
						>{$t('score.advantages')} {f1Adv}</span
					>
				{/if}
				{#if match.f1_pen > 0}
					<span
						class="whitespace-nowrap"
						style="padding: 3px 9px; border-radius: 7px; background: rgba(239,68,68,.16); border: 1px solid rgba(239,68,68,.5); font-weight: 700; font-size: 13px; letter-spacing: .08em; color: #fca5a5;"
						>{$t('score.penalties')} {match.f1_pen}</span
					>
				{/if}
			</div>
		</div>

		<!-- Center: the running clock on a live card, VS on everything else -->
		<div class="flex flex-col items-center justify-center" style="gap: 6px; padding-top: 26px;">
			{#if isLive}
				<span
					class="inline-flex items-center {isPaused ? '' : 'animate-tick'}"
					style="gap: 7px; padding: 5px 13px; border-radius: 8px; background: rgba(22,192,95,.12); border: 1px solid rgba(22,192,95,.4); font-family: 'Chakra Petch', monospace; font-variant-numeric: tabular-nums; --text-secondary: #3ee08a;"
				>
					<Timer {match} class="text-[17px] font-bold" />
				</span>
			{:else}
				<span style="font-weight: 700; font-size: 16px; line-height: 1; letter-spacing: .1em; color: #556489;"
					>{$t('score.vs')}</span
				>
			{/if}
		</div>

		<!-- Fighter 2 -->
		<div class="flex flex-col items-center text-center" style="gap: 8px;">
			<span style="width: 46px; height: 5px; border-radius: 3px; background: {f2Color};"></span>
			<span
				class="uppercase"
				style="font-weight: 700; font-size: 22px; line-height: 1; letter-spacing: .02em; color: {f2NameColor};"
				>{match.f2_name}</span
			>
			<span
				style="font-family: 'Archivo', system-ui, sans-serif; font-weight: 900; font-size: 52px; line-height: 1; color: {f2ScoreColor};"
				>{f2Score}</span
			>
			<div class="flex" style="gap: 6px; min-height: 24px;">
				{#if f2Adv > 0}
					<span
						class="whitespace-nowrap"
						style="padding: 3px 9px; border-radius: 7px; background: rgba(244,180,0,.16); border: 1px solid rgba(244,180,0,.45); font-weight: 700; font-size: 13px; letter-spacing: .08em; color: #f4c453;"
						>{$t('score.advantages')} {f2Adv}</span
					>
				{/if}
				{#if match.f2_pen > 0}
					<span
						class="whitespace-nowrap"
						style="padding: 3px 9px; border-radius: 7px; background: rgba(239,68,68,.16); border: 1px solid rgba(239,68,68,.5); font-weight: 700; font-size: 13px; letter-spacing: .08em; color: #fca5a5;"
						>{$t('score.penalties')} {match.f2_pen}</span
					>
				{/if}
			</div>
		</div>
	</div>

	<!-- How it ended. The score row above cannot say: a match won by submission
	     shows the loser's numbers as the bigger ones. -->
	{#if outcome}
		<div
			class="relative flex items-center justify-center"
			style="margin-top: 8px; padding: 12px 22px; border-top: 1px solid rgba(255,255,255,.07); gap: 12px; background: rgba(255,255,255,.015);"
		>
			<span style="font-weight: 800; font-size: 15px; letter-spacing: .12em; color: #f4c453;"
				>{outcome.method}</span
			>
			<span style="font-weight: 500; font-size: 16px; color: #8391b0;">{outcome.detail}</span>
		</div>
	{:else if isLive}
		<!-- The green strip under a live card (design 2A) -->
		<div
			class="relative flex items-center justify-center"
			style="margin-top: 8px; padding: 11px 22px; border-top: 1px solid rgba(22,192,95,.18); gap: 9px; background: rgba(22,192,95,.05);"
		>
			<span
				class="animate-liveblink rounded-full"
				style="width: 7px; height: 7px; background: #2ee08a;"
			></span>
			<span style="font-weight: 700; font-size: 14px; letter-spacing: .14em; color: #3ee08a;"
				>{$t('status.inProgress')}</span
			>
		</div>
	{/if}

	<!-- Point breakdown (broadcast mode) -->
	{#if isBroadcast}
		<div class="relative border-t" style="padding: 12px 22px; border-color: rgba(255,255,255,.07);">
			<div
				class="grid grid-cols-[1fr_auto_1fr] text-center"
				style="gap: 16px; font-weight: 600; font-size: 15px; letter-spacing: .06em; color: #5f6d8a;"
			>
				<div class="flex justify-center" style="gap: 12px;">
					<span>{$t('score.pt2.card')} <span style="color: #ffffff;">{match.f1_pt2}</span></span>
					<span>{$t('score.pt3.card')} <span style="color: #ffffff;">{match.f1_pt3}</span></span>
					<span>{$t('score.pt4.card')} <span style="color: #ffffff;">{match.f1_pt4}</span></span>
				</div>
				<span>{$t('score.points')}</span>
				<div class="flex justify-center" style="gap: 12px;">
					<span>{$t('score.pt2.card')} <span style="color: #ffffff;">{match.f2_pt2}</span></span>
					<span>{$t('score.pt3.card')} <span style="color: #ffffff;">{match.f2_pt3}</span></span>
					<span>{$t('score.pt4.card')} <span style="color: #ffffff;">{match.f2_pt4}</span></span>
				</div>
			</div>
		</div>
	{/if}
</a>
