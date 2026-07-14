<script lang="ts">
	import type { MatchEvent } from '$lib/types.js';
	import { formatTime, getRemainingSeconds, isMatchPaused, isTimerWarning } from '$lib/scoring.js';

	interface Props {
		match: MatchEvent;
		large?: boolean;
		/** Typography override. When set, the caller owns font family and size. */
		class?: string;
		/** Base color when the timer is neither in warning nor expired. */
		tone?: 'muted' | 'bright';
	}

	let { match, large = false, class: typography = '', tone = 'muted' }: Props = $props();

	let displayTime = $state(computeDisplay());
	let warning = $state(false);
	let expired = $state(false);
	let paused = $state(false);

	let baseColor = $derived(tone === 'bright' ? '#ffffff' : 'var(--text-secondary)');

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

	function updateTimer(): void {
		displayTime = computeDisplay();
		warning = isTimerWarning(match);
		expired = match.status === 'in-progress' && getRemainingSeconds(match) === 0;
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

		const interval = setInterval(updateTimer, 1000);
		return () => clearInterval(interval);
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
