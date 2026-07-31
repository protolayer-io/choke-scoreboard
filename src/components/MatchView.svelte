<!--
	The broadcast board, and the three things it shows instead when there is no
	match to show.

	It lives in `components/` and not in the match route because a shared match
	link resolves ON THE ROOT PAGE — the app's App Links filter claims `/` and
	nothing else, so `?npub=…&match=…` never becomes a deeper path. Two callers
	render this: the route a viewer reaches from the board, and the root page
	holding a link it is still resolving. Leaving the markup in the route would
	have meant a second copy of a 300-line wall, drifting.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { theme } from '$lib/stores.js';
	import { BRAND_NAME, PLAY_STORE_URL } from '$lib/constants.js';
	import {
		getF1EffectiveAdvantages,
		getF1EffectivePoints,
		getF2EffectiveAdvantages,
		getF2EffectivePoints,
		getOutcome,
		getWinner,
		isMatchPaused
	} from '$lib/scoring.js';
	import { ON_GREEN_DARKEN, alpha, darken, sanitizeColor } from '$lib/colors.js';
	import { getBoardPalette, glow, halfWash, tint, type BoardStatus } from '$lib/board-theme.js';
	import { isFullscreen, toggleFullscreen } from '$lib/fullscreen.js';
	import { t } from '$lib/i18n/index.js';
	import { formatOutcome } from '$lib/i18n/outcome.js';
	import Timer from './Timer.svelte';
	import type { MatchEvent } from '$lib/types.js';

	/**
	 * Why there is no match on screen, when there is no match on screen.
	 *
	 * - `pending`  — one has been named and the feed has not answered yet. Not an
	 *   absence: an unfinished question, and saying "not found" here would be the
	 *   precise opposite of what the link promised, on the happy path.
	 * - `unresolved` — the feed settled and this id is not in it. Almost always a
	 *   link older than the 24-hour window.
	 * - `broken` — the URL itself is unreadable. Kept apart from `unresolved`
	 *   because telling this person the match ended is a different lie.
	 */
	export type MissingReason = 'pending' | 'unresolved' | 'broken';

	let {
		match,
		missing = 'unresolved',
		onExit
	}: { match?: MatchEvent; missing?: MissingReason; onExit?: () => void } = $props();

	/**
	 * How to leave.
	 *
	 * On the match ROUTE the way out is a link to `/` and the router does the
	 * rest. On the root page it cannot be: the shared match view IS `/`, so an
	 * anchor pointing there navigates nowhere and strands the viewer on a dead
	 * end with a working-looking way off it. So the caller may hand over a
	 * dismissal instead, and the board stays exactly one deliberate tap away —
	 * which is the whole point. It is never a silent substitution.
	 */
	const exits = $derived(onExit !== undefined);

	const DEFAULT_F1_COLOR = '#13c88a';
	const DEFAULT_F2_COLOR = '#ff9f33';

	// The label is a message key, not a word — the wall has to say it in the
	// language of the room it hangs in. The KEYS of this map are wire values and
	// stay English forever; only the labels travel.
	//
	// The colors that went with them now live in $lib/board-theme.js, because the
	// board has two of everything: what reads as LIVE on near-black is a
	// highlighter stroke on white. `paused` is here because a paused match is
	// still 'in-progress' on the wire and has no status of its own to name.
	//
	// `satisfies` and not a type annotation: annotating would widen these to
	// `string` and cost $t its key checking, which is all that stands between a
	// typo here and a board saying `status.live` out loud.
	const STATUS_LABELS = {
		waiting: 'status.waiting',
		'in-progress': 'status.live',
		finished: 'status.final',
		canceled: 'status.canceled',
		paused: 'status.paused'
	} as const satisfies Record<BoardStatus, string>;

	// Effective: a penalty against the opponent has already become points — and
	// its second one has already become an advantage. Showing the raw advantage
	// next to an effective score would be two different matches on one screen.
	let f1Score = $derived(match ? getF1EffectivePoints(match) : 0);
	let f2Score = $derived(match ? getF2EffectivePoints(match) : 0);
	let f1Adv = $derived(match ? getF1EffectiveAdvantages(match) : 0);
	let f2Adv = $derived(match ? getF2EffectiveAdvantages(match) : 0);

	// The point breakdown, keyed by the point value and NOT by the label on
	// screen: the label is translated now, and a key that changes with the
	// language would make Svelte tear down and rebuild these three every time the
	// room changes language.
	let f1Breakdown = $derived([
		{ id: 'pt2', label: $t('score.pt2.wall'), value: match?.f1_pt2 ?? 0 },
		{ id: 'pt3', label: $t('score.pt3.wall'), value: match?.f1_pt3 ?? 0 },
		{ id: 'pt4', label: $t('score.pt4.wall'), value: match?.f1_pt4 ?? 0 }
	]);
	let f2Breakdown = $derived([
		{ id: 'pt2', label: $t('score.pt2.wall'), value: match?.f2_pt2 ?? 0 },
		{ id: 'pt3', label: $t('score.pt3.wall'), value: match?.f2_pt3 ?? 0 },
		{ id: 'pt4', label: $t('score.pt4.wall'), value: match?.f2_pt4 ?? 0 }
	]);

	let isLive = $derived(match?.status === 'in-progress');
	let isPaused = $derived(match ? isMatchPaused(match) : false);
	let isFinal = $derived(match?.status === 'finished');
	let showTimer = $derived(match?.status === 'waiting' || isLive);

	/**
	 * 1 = fighter 1 won, 2 = fighter 2 won, 0 = draw or not finished.
	 *
	 * Read from the event, never derived from the numbers: a fighter can lead
	 * 4–0 and lose to an armbar, and this page would otherwise announce the
	 * loser — on a wall, in a room full of people.
	 */
	let winner = $derived(match ? getWinner(match) : 0);
	let result = $derived(match && isFinal ? formatOutcome($t, getOutcome(match)) : null);

	// Which of the two boards this is. The theme is a property of the room rather
	// than of the match: an organizer who put the app in light mode is looking at a
	// bright hall or a projector that washes black out, and the wall should follow
	// them there. Design 1A on dark, design 3A on light.
	let palette = $derived(getBoardPalette($theme));

	let f1Color = $derived(sanitizeColor(match?.f1_color, DEFAULT_F1_COLOR));
	let f2Color = $derived(sanitizeColor(match?.f2_color, DEFAULT_F2_COLOR));

	// The winner's color as TEXT, which on a light board is not the value the edge
	// bar uses — see tint(). A draw has no color to borrow, and falls back to
	// whatever a finished match reads as here.
	let winnerColor = $derived(
		winner === 0 ? palette.status.finished.color : tint(palette, winner === 1 ? f1Color : f2Color)
	);

	let statusKey = $derived<BoardStatus>(isPaused ? 'paused' : (match?.status ?? 'waiting'));
	let statusColor = $derived(isFinal ? winnerColor : palette.status[statusKey].color);
	let statusDot = $derived(isFinal ? winnerColor : palette.status[statusKey].dot);

	// The dead end says what is actually known, and the three answers are not
	// interchangeable. `as const satisfies` keeps $t's key checking, which is all
	// that stands between a typo and a wall reading `match.expiredBody`.
	const MISSING_TITLES = {
		pending: 'match.pendingTitle',
		unresolved: 'match.notFoundTitle',
		broken: 'match.brokenTitle'
	} as const satisfies Record<MissingReason, string>;

	const MISSING_BODIES = {
		pending: 'match.pendingBody',
		unresolved: 'match.expiredBody',
		broken: 'match.brokenBody'
	} as const satisfies Record<MissingReason, string>;

	let isPending = $derived(!match && missing === 'pending');

</script>

<svelte:head>
	<title>{match ? $t('title.match', match.f1_name, match.f2_name) : $t('title.matchFallback')}</title>
</svelte:head>

{#if match}
	<!-- The three custom properties are for <Timer>, which is shared with the match
	     list and so cannot reach this palette: --board-ink is the color it prints
	     in, and the other two are the gold and red it switches to in the final
	     seconds — both of which need a darker shade to survive a white card. -->
	<div
		class="relative h-full w-full overflow-hidden"
		style="background:{palette.surface};--board-ink:{palette.ink};--color-gold:{palette.warn};--color-red-penalty:{palette.danger};font-family:'Barlow Condensed',system-ui,sans-serif"
	>
		<!-- Color wash per half -->
		<div class="absolute inset-y-0 left-0 w-1/2" style="background:{halfWash(palette.wash, f1Color, 100)}"></div>
		<div class="absolute inset-y-0 right-0 w-1/2" style="background:{halfWash(palette.wash, f2Color, 260)}"></div>

		<!-- Edge bars -->
		<div
			class="absolute inset-y-0 left-0 w-[11px]"
			style="background:{f1Color};box-shadow:{glow(palette.edgeGlow, f1Color)}"
		></div>
		<div
			class="absolute inset-y-0 right-0 w-[11px]"
			style="background:{f2Color};box-shadow:{glow(palette.edgeGlow, f2Color)}"
		></div>

		<!-- Fighter 1 (left) -->
		<div
			class="absolute inset-y-0 left-0 box-border flex w-1/2 flex-col items-center py-[5vh] pr-[16vw] pl-[3vw] md:px-[4vw]"
		>
			<div class="flex w-full min-w-0 items-center justify-center gap-[0.8vw]">
				<span
					class="h-[1.7vw] max-h-6 min-h-3 w-[1.7vw] max-w-6 min-w-3 shrink-0 rounded-md"
					style="background:{f1Color};box-shadow:{glow(palette.chipGlow, f1Color)}"
				></span>
				<span
					class="truncate font-extrabold tracking-wide uppercase"
					style="color:{palette.ink};font-size:clamp(0.9rem,3.2vw,58px);line-height:1.1"
				>
					{match.f1_name}
				</span>
			</div>

			<div class="flex flex-1 items-center justify-center">
				{#key f1Score}
					<div
						class="animate-scorepop font-black"
						style="color:{palette.ink};font-family:'Archivo',system-ui,sans-serif;font-size:clamp(4rem,13vw,232px);line-height:1;text-shadow:{glow(palette.scoreGlow, f1Color)}"
					>
						{f1Score}
					</div>
				{/key}
			</div>

			<div class="flex flex-col items-center gap-[2vh]">
				<div class="flex gap-[2vw]">
					{#each f1Breakdown as { id, label, value } (id)}
						<div class="text-center">
							<div class="font-bold tracking-[0.16em]" style="color:{palette.muted};font-size:clamp(0.6rem,1vw,19px)">
								{label}
							</div>
							<div class="mt-2 font-extrabold" style="color:{palette.ink};font-size:clamp(1.1rem,1.9vw,36px);line-height:1">
								{value}
							</div>
						</div>
					{/each}
				</div>
				<div class="flex gap-[0.7vw]">
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:{palette.advantage.bg};border:1px solid {palette.advantage.border}"
					>
						<span class="font-bold tracking-[0.1em]" style="color:{palette.advantage.label};font-size:clamp(0.75rem,1.25vw,24px)">{$t('score.advantages')}</span>
						<span class="font-extrabold" style="color:{palette.advantage.value};font-size:clamp(0.85rem,1.4vw,27px)">{f1Adv}</span>
					</div>
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:{palette.penalty.bg};border:1px solid {palette.penalty.border}"
					>
						<span class="font-bold tracking-[0.1em]" style="color:{palette.penalty.label};font-size:clamp(0.75rem,1.25vw,24px)">{$t('score.penalties')}</span>
						<span class="font-extrabold" style="color:{palette.penalty.value};font-size:clamp(0.85rem,1.4vw,27px)">{match.f1_pen}</span>
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
					style="background:{f2Color};box-shadow:{glow(palette.chipGlow, f2Color)}"
				></span>
				<span
					class="truncate font-extrabold tracking-wide uppercase"
					style="color:{palette.ink};font-size:clamp(0.9rem,3.2vw,58px);line-height:1.1"
				>
					{match.f2_name}
				</span>
			</div>

			<div class="flex flex-1 items-center justify-center">
				{#key f2Score}
					<div
						class="animate-scorepop font-black"
						style="color:{palette.ink};font-family:'Archivo',system-ui,sans-serif;font-size:clamp(4rem,13vw,232px);line-height:1;text-shadow:{glow(palette.scoreGlow, f2Color)}"
					>
						{f2Score}
					</div>
				{/key}
			</div>

			<div class="flex flex-col items-center gap-[2vh]">
				<div class="flex gap-[2vw]">
					{#each f2Breakdown as { id, label, value } (id)}
						<div class="text-center">
							<div class="font-bold tracking-[0.16em]" style="color:{palette.muted};font-size:clamp(0.6rem,1vw,19px)">
								{label}
							</div>
							<div class="mt-2 font-extrabold" style="color:{palette.ink};font-size:clamp(1.1rem,1.9vw,36px);line-height:1">
								{value}
							</div>
						</div>
					{/each}
				</div>
				<div class="flex gap-[0.7vw]">
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:{palette.advantage.bg};border:1px solid {palette.advantage.border}"
					>
						<span class="font-bold tracking-[0.1em]" style="color:{palette.advantage.label};font-size:clamp(0.75rem,1.25vw,24px)">{$t('score.advantages')}</span>
						<span class="font-extrabold" style="color:{palette.advantage.value};font-size:clamp(0.85rem,1.4vw,27px)">{f2Adv}</span>
					</div>
					<div
						class="flex items-center gap-2 rounded-[10px] px-[1vw] py-[0.9vh]"
						style="background:{palette.penalty.bg};border:1px solid {palette.penalty.border}"
					>
						<span class="font-bold tracking-[0.1em]" style="color:{palette.penalty.label};font-size:clamp(0.75rem,1.25vw,24px)">{$t('score.penalties')}</span>
						<span class="font-extrabold" style="color:{palette.penalty.value};font-size:clamp(0.85rem,1.4vw,27px)">{match.f2_pen}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Dim the loser's half -->
		{#if winner === 2}
			<div class="absolute inset-y-0 left-0 z-[4] w-1/2" style="background:{palette.loserDim}"></div>
		{:else if winner === 1}
			<div class="absolute inset-y-0 right-0 z-[4] w-1/2" style="background:{palette.loserDim}"></div>
		{/if}

		<!-- Center column: status, timer, VS -->
		<div
			class="absolute inset-y-0 left-1/2 z-[5] flex w-[28vw] max-w-[360px] -translate-x-1/2 flex-col items-center py-[5vh]"
		>
			<!-- The status pill has to hold a word it did not choose. English says
			     LIVE in four letters; Spanish says EN ESPERA and Portuguese
			     AGUARDANDO, two and a half times as wide. So the pill is bounded by
			     its column (max-w-full) and the word truncates inside it, instead of
			     running out under the fighters' names.

			     Truncation is the last line of defence, not the plan: the length
			     budget in i18n.test.ts is what keeps a status short enough to be
			     read whole. -->
			<div
				class="inline-flex max-w-full items-center gap-2 rounded-full px-[1.2vw] py-[1vh]"
				style="background:{alpha(statusColor, 0.12)};border:1px solid {alpha(statusColor, 0.5)}"
			>
				<span
					class="h-3 w-3 shrink-0 rounded-full {isLive && !isPaused ? 'animate-liveblink' : ''}"
					style="background:{statusDot};box-shadow:{glow(palette.dotGlow, statusDot)}"
				></span>
				<span
					class="min-w-0 truncate font-bold tracking-[0.16em]"
					style="color:{statusColor};font-size:clamp(0.7rem,1.25vw,24px)"
				>
					{$t(STATUS_LABELS[statusKey])}
				</span>
			</div>

			<div class="flex flex-1 flex-col items-center justify-center gap-5">
				{#if showTimer}
					<div
						class="flex flex-col items-center gap-3 rounded-[18px] px-[1.8vw] py-[2.5vh]"
						style="background:{palette.card.bg};border:1px solid {palette.card.border};box-shadow:{palette.card.shadow}"
					>
						<span class="font-bold tracking-[0.3em]" style="color:{palette.muted};font-size:clamp(0.55rem,0.9vw,17px)">
							{$t('score.time')}
						</span>
						<Timer {match} tone="bright" class="text-[clamp(2.5rem,5.2vw,76px)] leading-none" />
					</div>
					<div
						class="font-extrabold tracking-[0.14em]"
						style="color:{palette.vs};font-size:clamp(1rem,1.7vw,32px)"
					>
						{$t('score.vs')}
					</div>
				{/if}
			</div>
		</div>

		<!-- Winner banner -->
		{#if isFinal && result}
			<div
				class="animate-sweep-in absolute top-1/2 left-1/2 z-[6] flex max-w-[86vw] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-3xl px-[3vw] py-[3vh] text-center {palette
					.banner.frosted
					? 'backdrop-blur-sm'
					: ''}"
				style="background:{palette.banner.bg};border:1px solid {alpha(
					winnerColor,
					palette.banner.lineOpacity
				)};box-shadow:{palette.banner.shadow}"
			>
				<div class="font-bold tracking-[0.36em]" style="color:{palette.bannerMuted};font-size:clamp(0.7rem,1.25vw,24px)">
					{winner === 0 ? $t('score.result') : $t('score.winner')}
				</div>
				{#if winner !== 0}
					<div
						class="font-extrabold uppercase"
						style="color:{winnerColor};font-size:clamp(2rem,6vw,86px);line-height:1;text-shadow:{glow(
							palette.nameGlow,
							winnerColor
						)}"
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
				<div class="font-semibold" style="color:{palette.bannerMuted};font-size:clamp(0.8rem,1.3vw,25px)">
					{result.detail}
				</div>
			</div>
		{/if}

		<!-- Overlay controls -->
		{#snippet backChevron()}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6" />
			</svg>
			{$t('match.back')}
		{/snippet}

		{#if exits}
			<button
				type="button"
				onclick={onExit}
				class="absolute top-4 left-6 z-10 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-transparent px-3 py-2 text-sm transition-colors {palette.chrome}"
			>
				{@render backChevron()}
			</button>
		{:else}
			<a
				href="{base}/"
				class="absolute top-4 left-6 z-10 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm no-underline transition-colors {palette.chrome}"
			>
				{@render backChevron()}
			</a>
		{/if}

		<button
			type="button"
			onclick={() => toggleFullscreen()}
			class="absolute top-4 right-6 z-10 rounded-lg px-3 py-2 text-sm transition-colors {palette.chrome}"
		>
			{$isFullscreen ? $t('fullscreen.exit') : $t('fullscreen.enter')}
		</button>

		<!--
			The viral loop.

			This board is watched by a room full of people who did not install
			anything, and it is the only advertisement the app has: without a line
			saying where the scores come from, a spectator who wants this for their own
			gym has nothing to go on.

			It lives HERE, in the page, because the layout deliberately renders no
			footer for this route — and it sits along the bottom edge, the one band of
			the wall neither fighter's column nor the centre clock uses.

			Deliberately dimmer than the Back and Fullscreen controls: `palette.muted`
			rather than the chrome's own text color. Those two are for the operator
			standing at the laptop; this one is for someone across the gym, and must
			never pull an eye off the score. `palette.chrome` still carries the hover
			affordance for the operator who does go looking for it.
		-->
		<a
			href={PLAY_STORE_URL}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={$t('cta.getTheApp')}
			class="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg px-3 py-1.5 whitespace-nowrap no-underline transition-colors {palette.chrome}"
			style="color:{palette.muted};font-family:'Barlow Condensed', system-ui, sans-serif;font-weight:600;font-size:clamp(0.6rem,1.05vw,17px);letter-spacing:0.12em"
		>
			{$t('cta.scoredWith', BRAND_NAME)}
		</a>
	</div>
{:else}
	<div
		class="flex h-full flex-col items-center justify-center text-center"
		style="background:{palette.surface}"
	>
		<!--
			Pending is a different face, not a different sentence.

			A shrug emoji is an answer, and while the relays are still being asked
			there isn't one yet — showing it here would tell a person who followed a
			working link, to a live match, that their fight does not exist, in the
			half-second before it appears. So Pending gets the spinner the board
			already uses for the same wait, and the shrug is kept for the two states
			that really are a dead end.
		-->
	<div role="status" aria-live="polite" class="flex flex-col items-center">
		{`#if` isPending}
			<div
				aria-hidden="true"
				class="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
				style="border-color: var(--border-color); border-top-color: var(--color-green-live);"
			></div>
		{:else}
			<span class="text-5xl" aria-hidden="true">🤷</span>
		{/if}
		<p class="mt-4 text-lg font-medium" style="color: var(--text-secondary);">
			{$t(MISSING_TITLES[missing])}
		</p>
		<p class="mt-1 max-w-sm text-sm" style="color: var(--text-secondary);">
			{$t(MISSING_BODIES[missing])}
		</p>
	</div>

		<!--
			The dead end, which is the best moment this app gets.

			Matches age out after a day; the links to them do not, and go on sitting
			in the chat thread they were pasted into. Whoever follows one afterwards
			came here on purpose, wanting to watch this exact match — the warmest
			visitor the app will ever have — and until now the page spent that on a
			shrug and a link to a scoreboard belonging to somebody else.

			It also has NO footer to fall back on: this route renders under the
			broadcast layout, which draws neither header nor footer. Whatever the
			invitation is, it has to be here.

			So this one is loud, unlike the wall's. There is no score for it to pull
			an eye away from, and the button is the only thing on the page worth
			doing — `match.backToScoreboard` stays underneath it, demoted to what it
			always was: the way out for the operator who mistyped a match id.

			Withheld while Pending, and only while Pending. This pitch is for someone
			whose journey ended here; flashing it under a spinner would pitch the app
			to a person who is two seconds away from watching the match, and then take
			it away again. The board link below is withheld with it for the same
			reason — an exit offered before there is anything to exit from.
		-->
		{#if !isPending}
		<p class="mt-8 max-w-xs text-sm" style="color: var(--text-secondary);">
			{$t('cta.deadEndPitch')}
		</p>
		<a
			href={PLAY_STORE_URL}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={$t('cta.getTheApp')}
			class="mt-4 rounded-lg px-5 py-2.5 text-sm font-semibold no-underline transition-opacity hover:opacity-90"
			style="background: {darken('var(--color-green-live)', ON_GREEN_DARKEN)}; color: #ffffff;"
		>
			{$t('cta.install')}
		</a>

		{#if exits}
			<button
				type="button"
				onclick={onExit}
				class="mt-6 cursor-pointer bg-transparent text-sm underline"
				style="color: var(--text-secondary);">{$t('match.backToScoreboard')}</button
			>
		{:else}
			<a href="{base}/" class="mt-6 text-sm underline" style="color: var(--text-secondary);">{$t('match.backToScoreboard')}</a>
		{/if}
		{/if}
	</div>
{/if}
