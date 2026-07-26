/**
 * A once-a-second tick that lands on the second, not a second after whenever it
 * happened to start.
 *
 * The countdown is a function of `Math.floor(Date.now() / 1000)`: it changes on
 * the epoch-second boundary and nowhere else. `setInterval(fn, 1000)` knows
 * nothing about that boundary — it fires a second after it was armed, so its
 * phase is whatever the clock read at that moment. On this board that moment is
 * the arrival of a relay event, which makes the phase a function of NETWORK
 * JITTER: the board recomputes the right number, then leaves the previous second
 * on the wall until its next tick, and reads as much as a second behind the
 * referee's phone for the whole match. Every incoming score update re-rolls the
 * phase, and the browser's 1000 ms clamp walks it steadily later on top of that.
 *
 * So: no interval. Each tick schedules the next one from the CURRENT clock, aimed
 * just past the coming boundary. Lateness is therefore never inherited — a tick
 * delayed by a busy thread, a throttled tab or a sleeping laptop is absorbed by
 * the one delay that follows it, instead of shifting every tick after it.
 *
 * The clock and the timer are injected so the arithmetic can be tested without
 * waiting out real seconds; in the app, nobody passes them.
 */

/**
 * How far past the boundary to aim.
 *
 * Landing a hair BEFORE the boundary is the one useless place to land: at
 * 999.6 ms `Math.floor(now / 1000)` still reads the second that is about to end,
 * so the tick repaints the digits already showing and the real change waits out
 * another whole second.
 *
 * A spec-compliant `setTimeout` cannot do that on its own — it waits AT LEAST the
 * delay it was given, and browsers only ever clamp it longer. This is margin
 * against the two ways the clock can move out from under it: the delay is
 * computed from `Date.now()`, a wall clock an NTP step can shift, while the timer
 * honouring it is measured against the browser's own; and `Date.now()` may be
 * deliberately coarsened for privacy (Firefox's `privacy.resistFingerprinting`
 * clamps it to 100 ms), which can round it forward and make the delay short.
 *
 * So the margin is defensive, not load-bearing, and an early landing is survived
 * either way: the next delay is computed from wherever the clock actually is, so
 * a short tick costs one extra wakeup and re-aligns immediately. A few
 * milliseconds nobody can see is worth not relying on that.
 */
export const TICK_GUARD_MS = 5;

/** An opaque timer handle. Node and the browser disagree on the type; neither matters here. */
export type TimerHandle = unknown;

/** The clock and timer a ticker runs on. */
export interface TickerHost {
	now(): number;
	setTimeout(callback: () => void, ms: number): TimerHandle;
	clearTimeout(handle: TimerHandle): void;
}

const defaultHost: TickerHost = {
	now: () => Date.now(),
	setTimeout: (callback, ms) => setTimeout(callback, ms),
	clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

/**
 * How long to wait, from `nowMs`, for a tick that lands just past the next
 * second boundary.
 *
 * On a boundary exactly, that is a full second: the displayed second has only
 * just begun, and returning 0 would tick over and over inside it.
 */
export function delayToNextTick(nowMs: number): number {
	return 1000 - (nowMs % 1000) + TICK_GUARD_MS;
}

/**
 * Call `onTick` once per second, on the second, until the returned function is
 * called. Stopping twice is harmless — Svelte re-runs an effect's teardown.
 */
export function startSecondAlignedTicker(
	onTick: () => void,
	host: TickerHost = defaultHost
): () => void {
	let handle: TimerHandle = null;
	let stopped = false;

	function schedule(): void {
		handle = host.setTimeout(() => {
			handle = null;
			if (stopped) return;
			try {
				onTick();
			} finally {
				// In `finally`, so one throwing tick cannot end the countdown. An
				// interval survived a bad callback — the browser re-fires it whatever
				// happened — and scheduling after the call instead would freeze the
				// clock at that second for the rest of the match, with nothing left
				// pending and nobody told. The throw still propagates.
				//
				// Re-reading the clock here is also what keeps a LATE tick from
				// dragging every tick after it: the next delay is measured from where
				// the clock actually is, not from where this tick was due.
				if (!stopped) schedule();
			}
		}, delayToNextTick(host.now()));
	}

	schedule();

	return () => {
		stopped = true;
		if (handle !== null) {
			host.clearTimeout(handle);
			handle = null;
		}
	};
}
