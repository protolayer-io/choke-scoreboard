import { describe, expect, it, vi } from 'vitest';

import { TICK_GUARD_MS, delayToNextTick, startSecondAlignedTicker, type TickerHost } from './tick.js';

/**
 * The countdown reads `Math.floor(Date.now() / 1000)`, so the number on the wall
 * changes on the second boundary and nowhere else. A tick that lands mid-second
 * therefore leaves the PREVIOUS second showing for the rest of this one — which
 * is the delay the referee sees against the phone in their hand.
 *
 * These tests hold the scheduling that keeps the board on the boundary: where the
 * first tick lands, and that a late one does not drag the next one with it.
 *
 * They run without a DOM or real timers on purpose. The ticker takes the clock
 * and the timer it uses, so a plain object proves the arithmetic in no time at
 * all — a test that actually waited for boundaries would cost a second per tick.
 */

/** A clock and a timer queue the test drives by hand. */
function fakeHost(startMs: number) {
	let now = startMs;
	let nextHandle = 1;
	const pending = new Map<number, { at: number; callback: () => void }>();

	const host: TickerHost = {
		now: () => now,
		setTimeout(callback, ms) {
			const handle = nextHandle++;
			pending.set(handle, { at: now + ms, callback });
			return handle;
		},
		clearTimeout(handle) {
			pending.delete(handle as number);
		}
	};

	function earliest() {
		let found: { handle: number; at: number; callback: () => void } | null = null;
		for (const [handle, entry] of pending) {
			if (!found || entry.at < found.at) found = { handle, ...entry };
		}
		return found;
	}

	return {
		host,
		now: () => now,
		pendingCount: () => pending.size,
		/** When the earliest pending timeout is due, as a delay from now. */
		nextDelay: () => {
			const next = earliest();
			if (!next) throw new Error('nothing scheduled');
			return next.at - now;
		},
		/**
		 * Fire the earliest timeout, optionally `latenessMs` after it was due —
		 * which is what a busy main thread, a throttled tab or a laptop waking from
		 * sleep actually does to a timer.
		 */
		runNext(latenessMs = 0) {
			const next = earliest();
			if (!next) throw new Error('nothing scheduled');
			pending.delete(next.handle);
			now = next.at + latenessMs;
			next.callback();
		}
	};
}

/** Where a delay scheduled now would land inside its second. */
function landingOffset(nowMs: number, delayMs: number): number {
	return (nowMs + delayMs) % 1000;
}

describe('delayToNextTick', () => {
	it('waits out the rest of the current second, then a guard', () => {
		// Arrange — 300 ms into a second
		const now = 1_700_000_000_300;

		// Act
		const delay = delayToNextTick(now);

		// Assert
		expect(delay).toBe(700 + TICK_GUARD_MS);
	});

	it('lands just past the boundary, from anywhere in the second', () => {
		// Arrange / Act / Assert — every millisecond of a second, same landing
		for (let offset = 0; offset < 1000; offset++) {
			const now = 1_700_000_000_000 + offset;
			expect(landingOffset(now, delayToNextTick(now))).toBe(TICK_GUARD_MS);
		}
	});

	it('waits a whole second when called exactly on a boundary', () => {
		// Arrange — the boundary just passed, so the displayed second is fresh
		const now = 1_700_000_000_000;

		// Act
		const delay = delayToNextTick(now);

		// Assert — a zero delay here would spin, ticking over and over on one second
		expect(delay).toBe(1000 + TICK_GUARD_MS);
	});

	it('clears the boundary rather than sitting on it', () => {
		// A timer may fire a hair early, and `Math.floor(now / 1000)` would then
		// still read the old second — the tick would repaint the same digits and
		// the real change would wait a full second more.
		expect(TICK_GUARD_MS).toBeGreaterThan(0);
	});
});

describe('startSecondAlignedTicker', () => {
	it('schedules its first tick on the coming boundary, not a second from now', () => {
		// Arrange — mounted 800 ms into a second, as an arriving relay event does
		const clock = fakeHost(1_700_000_000_800);

		// Act
		startSecondAlignedTicker(() => {}, clock.host);

		// Assert — 200 ms away, not 1000
		expect(clock.nextDelay()).toBe(200 + TICK_GUARD_MS);
	});

	it('keeps ticking, once per second', () => {
		// Arrange
		const clock = fakeHost(1_700_000_000_000);
		const onTick = vi.fn();
		startSecondAlignedTicker(onTick, clock.host);

		// Act
		clock.runNext();
		clock.runNext();
		clock.runNext();

		// Assert
		expect(onTick).toHaveBeenCalledTimes(3);
		expect(clock.pendingCount()).toBe(1);
	});

	it('re-aligns after a late tick instead of drifting behind it', () => {
		// Arrange — this is the whole point. setInterval(1000) never catches up: the
		// browser clamps it, the callback runs late, and every following tick
		// inherits the lateness until the board is a second behind the phone.
		const clock = fakeHost(1_700_000_000_000);
		startSecondAlignedTicker(() => {}, clock.host);

		// Act — the tick fires 400 ms after it was due
		clock.runNext(400);

		// Assert — the next one still lands just past a boundary, not 400 ms into it.
		// The clock now reads 405 ms into a second (the 5 ms guard, plus the 400 ms
		// of lateness), so the wait is the 595 ms left of it plus a fresh guard.
		expect(landingOffset(clock.now(), clock.nextDelay())).toBe(TICK_GUARD_MS);
		expect(clock.nextDelay()).toBe(595 + TICK_GUARD_MS);
	});

	it('recovers from a tick so late it skipped whole seconds', () => {
		// Arrange — a laptop that was asleep, or a tab the browser froze
		const clock = fakeHost(1_700_000_000_000);
		startSecondAlignedTicker(() => {}, clock.host);

		// Act — three and a half seconds late
		clock.runNext(3500);

		// Assert — one tick to the next boundary, no backlog of missed ones
		expect(landingOffset(clock.now(), clock.nextDelay())).toBe(TICK_GUARD_MS);
		expect(clock.pendingCount()).toBe(1);
	});

	it('stops when told to, leaving no timer behind', () => {
		// Arrange
		const clock = fakeHost(1_700_000_000_000);
		const onTick = vi.fn();
		const stop = startSecondAlignedTicker(onTick, clock.host);
		clock.runNext();

		// Act — the match finished, or the component went away
		stop();

		// Assert — nothing left to fire at a component that is gone
		expect(clock.pendingCount()).toBe(0);
		expect(onTick).toHaveBeenCalledTimes(1);
	});

	it('is safe to stop twice', () => {
		// Arrange — Svelte runs an effect's teardown on every re-run, and a match
		// that pauses and resumes runs it plenty.
		const clock = fakeHost(1_700_000_000_000);
		const stop = startSecondAlignedTicker(() => {}, clock.host);

		// Act / Assert
		stop();
		expect(() => stop()).not.toThrow();
		expect(clock.pendingCount()).toBe(0);
	});
});
