<script lang="ts">
	import type { MatchEvent, ViewMode } from '$lib/types.js';
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
	import { sanitizeColor } from '$lib/colors.js';
	import { getCardPalette, halfWash, tint, type BoardStatus } from '$lib/board-theme.js';
	import { theme } from '$lib/stores.js';
	import { t } from '$lib/i18n/index.js';
	import { formatOutcome } from '$lib/i18n/outcome.js';
	import Timer from './Timer.svelte';
	import { base } from '$app/paths';

	interface Props {
		match: MatchEvent;
		mode: ViewMode;
	}

	let { match, mode }: Props = $props();

	// The card's own status pill (design 2A). The KEYS of this map are wire values
	// and stay English forever; only the labels travel through $t.
	//
	// The colors that went with them now live in $lib/board-theme.js: the card is
	// drawn twice, like the board it links to. `paused` is here because a paused
	// match is still 'in-progress' on the wire and has no status of its own.
	//
	// `satisfies` and not a type annotation, so $t keeps checking these keys.
	const STATUS_LABELS = {
		'in-progress': 'status.live',
		waiting: 'status.waiting',
		finished: 'status.finished',
		canceled: 'status.canceled',
		paused: 'status.paused'
	} as const satisfies Record<BoardStatus, string>;

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

	// The card is drawn twice, like the board it links to: design 2A on navy, and
	// its own light counterpart. It used to be navy under both themes on the
	// argument that a scoreboard is dark — an argument design 3A retired.
	let card = $derived(getCardPalette($theme));

	let statusKey = $derived<BoardStatus>(isLive && isPaused ? 'paused' : match.status);
	let pill = $derived(card.status[statusKey]);

	// Winner in the card's ink, loser sunk toward the background; undecided keeps
	// both bright. Which way "sunk" goes is a property of the theme — on navy the
	// loser gets darker, on paper it gets lighter — so it comes from the palette
	// and never from a literal here.
	let f1NameColor = $derived(decided && winner !== 1 ? card.dimName : card.ink);
	let f2NameColor = $derived(decided && winner !== 2 ? card.dimName : card.ink);

	// A winning score is printed in the fighter's own color, so it goes through
	// tint(): at 52px on white, an unmodified bright belt color is not a color.
	let f1ScoreColor = $derived(
		decided ? (winner === 1 ? tint(card, f1Color) : card.dimScore) : card.ink
	);
	let f2ScoreColor = $derived(
		decided ? (winner === 2 ? tint(card, f2Color) : card.dimScore) : card.ink
	);

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
	style="border-radius: 16px; background: {card.surface}; border: 1px solid {card.border}; box-shadow: {card.shadow}; font-family: 'Barlow Condensed', system-ui, sans-serif; --color-gold: {card.warn}; --color-red-penalty: {card.danger};"
>
	<!-- Per-fighter color washes and edge bars: the fighter's color is the
	     protagonist (design 2A). -->
	<div
		class="pointer-events-none absolute"
		style="inset: 0 50% 0 0; background: {halfWash(card.wash, f1Color, 100)};"
	></div>
	<div
		class="pointer-events-none absolute"
		style="inset: 0 0 0 50%; background: {halfWash(card.wash, f2Color, 260)};"
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
				class="rounded-full {isLive && !isPaused ? 'animate-liveblink' : ''}"
				style="width: 8px; height: 8px; background: {pill.dot};"
			></span>
			<span style="font-weight: 700; font-size: 13px; letter-spacing: .14em; color: {pill.text};"
				>{$t(STATUS_LABELS[statusKey])}</span
			>
		</span>
		<span
			style="font-family: 'Chakra Petch', monospace; font-weight: 600; font-size: 15px; letter-spacing: .06em; color: {card.clock}; font-variant-numeric: tabular-nums; --text-secondary: {card.clock};"
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
						style="padding: 3px 9px; border-radius: 7px; background: {card.advantage.bg}; border: 1px solid {card.advantage.border}; font-weight: 700; font-size: 13px; letter-spacing: .08em; color: {card.advantage.text};"
						>{$t('score.advantages')} {f1Adv}</span
					>
				{/if}
				{#if match.f1_pen > 0}
					<span
						class="whitespace-nowrap"
						style="padding: 3px 9px; border-radius: 7px; background: {card.penalty.bg}; border: 1px solid {card.penalty.border}; font-weight: 700; font-size: 13px; letter-spacing: .08em; color: {card.penalty.text};"
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
					style="gap: 7px; padding: 5px 13px; border-radius: 8px; background: {card.liveClock.bg}; border: 1px solid {card.liveClock.border}; font-family: 'Chakra Petch', monospace; font-variant-numeric: tabular-nums; --text-secondary: {card.liveClock.text};"
				>
					<Timer {match} class="text-[17px] font-bold" />
				</span>
			{:else}
				<span style="font-weight: 700; font-size: 16px; line-height: 1; letter-spacing: .1em; color: {card.vs};"
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
						style="padding: 3px 9px; border-radius: 7px; background: {card.advantage.bg}; border: 1px solid {card.advantage.border}; font-weight: 700; font-size: 13px; letter-spacing: .08em; color: {card.advantage.text};"
						>{$t('score.advantages')} {f2Adv}</span
					>
				{/if}
				{#if match.f2_pen > 0}
					<span
						class="whitespace-nowrap"
						style="padding: 3px 9px; border-radius: 7px; background: {card.penalty.bg}; border: 1px solid {card.penalty.border}; font-weight: 700; font-size: 13px; letter-spacing: .08em; color: {card.penalty.text};"
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
			style="margin-top: 8px; padding: 12px 22px; border-top: 1px solid {card.outcome.border}; gap: 12px; background: {card.outcome.bg};"
		>
			<span style="font-weight: 800; font-size: 15px; letter-spacing: .12em; color: {card.outcome.method};"
				>{outcome.method}</span
			>
			<span style="font-weight: 500; font-size: 16px; color: {card.outcome.detail};">{outcome.detail}</span>
		</div>
	{:else if isLive}
		<!-- The green strip under a live card (design 2A) -->
		<div
			class="relative flex items-center justify-center"
			style="margin-top: 8px; padding: 11px 22px; border-top: 1px solid {card.liveBar.border}; gap: 9px; background: {card.liveBar.bg};"
		>
			<!-- The strip has to agree with the pill above it. A paused match is
			     still `in-progress`, so this used to blink "IN PROGRESS" while the
			     pill three inches up read PAUSED: one card, two readings, and the
			     blinking one is the one that catches the eye across a room.
			     The label stays `status.inProgress` rather than the pill's
			     `status.live` — the strip is a caption for the card, not a second
			     copy of the badge. -->
			<span
				class="rounded-full {isPaused ? '' : 'animate-liveblink'}"
				style="width: 7px; height: 7px; background: {card.liveBar.dot};"
			></span>
			<span style="font-weight: 700; font-size: 14px; letter-spacing: .14em; color: {card.liveBar.text};"
				>{$t(isPaused ? STATUS_LABELS.paused : 'status.inProgress')}</span
			>
		</div>
	{/if}

	<!-- Point breakdown (broadcast mode) -->
	{#if isBroadcast}
		<div class="relative border-t" style="padding: 12px 22px; border-color: {card.border};">
			<div
				class="grid grid-cols-[1fr_auto_1fr] text-center"
				style="gap: 16px; font-weight: 600; font-size: 15px; letter-spacing: .06em; color: {card.muted};"
			>
				<div class="flex justify-center" style="gap: 12px;">
					<span>{$t('score.pt2.card')} <span style="color: {card.ink};">{match.f1_pt2}</span></span>
					<span>{$t('score.pt3.card')} <span style="color: {card.ink};">{match.f1_pt3}</span></span>
					<span>{$t('score.pt4.card')} <span style="color: {card.ink};">{match.f1_pt4}</span></span>
				</div>
				<span>{$t('score.points')}</span>
				<div class="flex justify-center" style="gap: 12px;">
					<span>{$t('score.pt2.card')} <span style="color: {card.ink};">{match.f2_pt2}</span></span>
					<span>{$t('score.pt3.card')} <span style="color: {card.ink};">{match.f2_pt3}</span></span>
					<span>{$t('score.pt4.card')} <span style="color: {card.ink};">{match.f2_pt4}</span></span>
				</div>
			</div>
		</div>
	{/if}
</a>
