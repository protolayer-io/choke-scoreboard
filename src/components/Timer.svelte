<script lang="ts">
	import type { MatchEvent } from '$lib/types.js';
	import { formatTime, getRemainingSeconds, isMatchPaused, isTimerWarning } from '$lib/scoring.js';
	import { startSecondAlignedTicker } from '$lib/tick.js';

	interface Props {
		match: MatchEvent;
		large?: boolean;
		/** Typography override. When set, the caller owns font family and size. */
		class?: string;
		/** Base color when the timer is neither in warning nor expired. */
		tone?: 'muted' | 'bright';
	}

	let { match, large = false, class: typography = '', tone = 'muted' }: Props = $props();

	/**
	 * `bright` means "the loudest color on the surface behind me", and that surface
	 * is not always dark: the broadcast board has a light theme (design 3A) where
	 * the clock is near-black ink on a white card. That board sets --board-ink; the
	 * fallback keeps every other caller on white.
	 */
	const BRIGHT = 'var(--board-ink, #ffffff)';

	let displayTime = $state(computeDisplay());
	let warning = $state(false);
	let expired = $state(false);
	let paused = $state(false);

	let baseColor = $derived(tone === 'bright' ? BRIGHT : 'var(--text-secondary)');

	function computeDisplay(): string {
		switch (match.status) {
			case 'waiting':
				return formatTime(match.duration);
			case 'in-progress':
				return formatTime(getRemainingSeconds(match));
			case 'finished':
			case 'canceled':
				return '--:--';
		}
	}

	/**
	 * A running clock with nothing left on it.
	 *
	 * Derived from the match rather than read back off `expired`, because the effect
	 * below needs this too: reading a `$state` it also writes would make the effect
	 * invalidate itself on every tick.
	 */
	function isExpired(): boolean {
		return match.status === 'in-progress' && getRemainingSeconds(match) === 0;
	}

	function updateTimer(): void {
		displayTime = computeDisplay();
		warning = isTimerWarning(match);
		expired = isExpired();
		paused = isMatchPaused(match);
	}

	// Manage the countdown interval reactively.
	// Runs whenever status, paused_at, start_at or duration changes (e.g. waiting → in-progress).
	// Starts the interval when the match is running, clears it on any other change.
	//
	// A paused match is still 'in-progress': without paused_at in this list the
	// clock would keep ticking down at a referee who has it stopped, and the
	// pause event would land with no visible effect at all.
	$effect(() => {
		void match.status;
		void match.paused_at;
		void match.start_at;
		void match.duration;

		updateTimer();

		if (match.status !== 'in-progress' || isMatchPaused(match)) return;

		// A clock at 0:00 has nothing left to count. The match stays 'in-progress'
		// until the referee names the outcome, so without this the board would go on
		// waking every second to recompute a zero.
		if (isExpired()) return;

		// On the second, not a second from now. This effect re-runs whenever a relay
		// event lands, so an interval armed here would take its phase from network
		// jitter and hold each second on the wall past the moment it changed — the
		// board reading behind the referee's phone all match. See lib/tick.ts.
		//
		// The ticker stops itself on reaching zero: expiry is a fact about the clock,
		// not about the match, so no incoming event will re-run this effect to do it.
		const stop = startSecondAlignedTicker(() => {
			updateTimer();
			if (isExpired()) stop();
		});
		return stop;
	});
</script>

<div
	class="font-bold tabular-nums tracking-wider {typography ||
		`font-mono ${large ? 'text-4xl' : 'text-xl'}`} {warning && !paused
		? tone === 'bright'
			? 'animate-tick'
			: 'animate-pulse-live'
		: ''}"
	style="color: {warning ? 'var(--color-gold, #F5B800)' : expired ? 'var(--color-red-penalty, #C0392B)' : baseColor}"
>
	{displayTime}
</div>
