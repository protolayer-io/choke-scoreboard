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
 * Timers are allowed to fire a hair early, and landing at 999.6 ms means
 * `Math.floor(now / 1000)` still reads the second that is about to end: the tick
 * repaints the digits already showing, and the real change waits out another
 * whole second. A few milliseconds of margin costs nothing anyone can see and
 * makes that impossible.
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
			onTick();
			// Re-read the clock rather than assuming this ran on time: that is what
			// keeps a late tick from dragging every tick after it.
			if (!stopped) schedule();
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
