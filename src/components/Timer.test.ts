// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Timer from './Timer.svelte';
import { reactiveProps } from './reactive-props.svelte.js';
import { TICK_GUARD_MS } from '../lib/tick.js';
import type { MatchEvent } from '../lib/types.js';

/**
 * The one test that holds the fix in place.
 *
 * `tick.test.ts` proves the scheduler in isolation, and proves it thoroughly —
 * but it cannot see whether this component USES it. Swapping the ticker back to
 * `setInterval(updateTimer, 1000)` left the entire suite green, which means the
 * two-second delay this all exists to fix could return as a one-line
 * "simplification" and nothing would say a word. So this mounts the real
 * component and watches the real DOM.
 *
 * The assertion that does the work is the SMALL advance: the clock is set 800 ms
 * into a second, and the display must change 205 ms later — when the second
 * boundary actually passes. An interval armed at mount would need a full 1000 ms,
 * so it fails this test, which is the entire point of writing it.
 *
 * This is the only component test in the repo; everything else lives in `src/lib`
 * and runs without a DOM. It needs jsdom (the docblock above) and Svelte's
 * browser entry (see `resolve.conditions` in vite.config.ts).
 */

/** 800 ms into a second, so a boundary is close but not here. */
const MOUNTED_AT_MS = 1_700_000_000_800;
const STARTED_AT_S = 1_700_000_000;

/** Just enough to carry the clock past the coming boundary, and no more. */
const TO_THE_BOUNDARY_MS = 200 + TICK_GUARD_MS;

function match(over: Partial<MatchEvent> = {}): MatchEvent {
	return {
		id: 'abcd',
		status: 'in-progress',
		start_at: STARTED_AT_S,
		duration: 300,
		f1_name: 'Bob',
		f2_name: 'Carlos',
		f1_pt2: 0,
		f2_pt2: 0,
		f1_pt3: 0,
		f2_pt3: 0,
		f1_pt4: 0,
		f2_pt4: 0,
		f1_adv: 0,
		f2_adv: 0,
		f1_pen: 0,
		f2_pen: 0,
		created_at: STARTED_AT_S,
		...over
	};
}

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

/**
 * Mount the real component into the document and hand back its text.
 *
 * The `flushSync` is not a formality: `mount` queues the effect rather than
 * running it, so without this the ticker is not armed yet and every assertion
 * about scheduled timers would pass by accident, on a component that had not
 * started.
 */
function render(props: { match: MatchEvent }) {
	component = mount(Timer, { target, props });
	flushSync();
	return () => target.textContent?.trim();
}

/**
 * Mount with props a test can replace afterwards, the way a relay event does.
 *
 * Mounting straight into a final state only ever proves what happens at mount:
 * every assertion below about pausing, resuming or finishing would hold just as
 * well if the component read its match once and never looked again.
 */
function renderLive(match: MatchEvent) {
	const props = reactiveProps({ match });
	component = mount(Timer, { target, props });
	flushSync();
	return {
		text: () => target.textContent?.trim(),
		/** Deliver a new version of the match, as the subscription would. */
		receive(next: MatchEvent) {
			props.match = next;
			flushSync();
		}
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(MOUNTED_AT_MS);
	target = document.createElement('div');
	document.body.appendChild(target);
});

afterEach(() => {
	if (component) unmount(component);
	component = null;
	target.remove();
	vi.useRealTimers();
});

describe('the countdown on screen', () => {
	it('starts at the time the match has left', () => {
		// Arrange / Act
		const text = render({ match: match() });

		// Assert
		expect(text()).toBe('5:00');
	});

	it('changes on the second boundary, not a second after mounting', () => {
		// Arrange — mounted 800 ms into a second, as an arriving relay event does
		const text = render({ match: match() });
		expect(text()).toBe('5:00');

		// Act — only far enough to cross the boundary
		vi.advanceTimersByTime(TO_THE_BOUNDARY_MS);
		flushSync();

		// Assert — an interval armed at mount would still be showing 5:00 here, and
		// would go on showing it for another 795 ms
		expect(text()).toBe('4:59');
	});

	it('keeps landing on the boundary second after second', () => {
		// Arrange
		const text = render({ match: match() });
		vi.advanceTimersByTime(TO_THE_BOUNDARY_MS);
		flushSync();

		// Act — three whole seconds from a clock now sitting just past a boundary
		for (let i = 0; i < 3; i++) {
			vi.advanceTimersByTime(1000);
			flushSync();
		}

		// Assert — no drift, no skipped or repeated second
		expect(text()).toBe('4:56');
	});

	it('shows the frozen clock of a paused match and does not tick it', () => {
		// Arrange — the referee stopped it with 4:00 left
		const text = render({
			match: match({ paused_at: STARTED_AT_S + 60 })
		});
		expect(text()).toBe('4:00');

		// Act — wall-clock time keeps passing; a paused clock does not drain
		vi.advanceTimersByTime(5000);
		flushSync();

		// Assert
		expect(text()).toBe('4:00');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('stops ticking once the clock is spent', () => {
		// Arrange — one second left, and a match stays 'in-progress' until the
		// referee names the outcome, so nothing else will come along and stop it
		const text = render({ match: match({ duration: 1 }) });
		expect(text()).toBe('0:01');

		// Act
		vi.advanceTimersByTime(TO_THE_BOUNDARY_MS);
		flushSync();

		// Assert — at zero, and no wakeup left scheduled to recompute it
		expect(text()).toBe('0:00');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('leaves no timer running after it is removed from the page', () => {
		// Arrange — navigating away from a live match
		render({ match: match() });
		expect(vi.getTimerCount()).toBe(1);

		// Act
		unmount(component!);
		component = null;

		// Assert — nothing left to fire at a component that is gone
		expect(vi.getTimerCount()).toBe(0);
	});

	it('stops the clock when the pause event arrives on a running match', () => {
		// Arrange — running, ticking
		const board = renderLive(match());
		expect(board.text()).toBe('5:00');
		expect(vi.getTimerCount()).toBe(1);

		// Act — the referee stops it with 4:00 left, and the event lands
		board.receive(match({ paused_at: STARTED_AT_S + 60 }));

		// Assert — a paused match is still 'in-progress', so only paused_at can say
		// so. Without it the board would drain time at a referee standing still.
		expect(board.text()).toBe('4:00');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('starts counting again when the match resumes', () => {
		// Arrange — paused at 4:00
		const board = renderLive(match({ paused_at: STARTED_AT_S + 60 }));
		expect(vi.getTimerCount()).toBe(0);

		// Act — five seconds of stoppage pass, then the app resumes: it charges the
		// stoppage to start_at, which leaves the remaining time exactly where it was
		vi.advanceTimersByTime(64_200); // → 65 s past the start, on a boundary
		board.receive(match({ start_at: STARTED_AT_S + 5 }));

		// Assert — right where it stopped, and running again
		expect(board.text()).toBe('4:00');
		expect(vi.getTimerCount()).toBe(1);

		// And still on the boundary, not on the phase of the event that resumed it
		vi.advanceTimersByTime(1000 + TICK_GUARD_MS);
		flushSync();
		expect(board.text()).toBe('3:59');
	});

	it('drops the clock when the match finishes mid-count', () => {
		// Arrange
		const board = renderLive(match());
		expect(vi.getTimerCount()).toBe(1);

		// Act — the referee names the outcome
		board.receive(match({ status: 'finished', winner: 'f1', method: 'submission' }));

		// Assert
		expect(board.text()).toBe('--:--');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('picks the clock up when a waiting match starts', () => {
		// Arrange — on the mat, not started
		const board = renderLive(match({ status: 'waiting', start_at: undefined }));
		expect(board.text()).toBe('5:00');
		expect(vi.getTimerCount()).toBe(0);

		// Act — the bell: the app stamps start_at and publishes
		board.receive(match({ start_at: STARTED_AT_S }));

		// Assert — ticking, and the first change still lands on the boundary
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(TO_THE_BOUNDARY_MS);
		flushSync();
		expect(board.text()).toBe('4:59');
	});

	it('shows no clock at all for a match that is over', () => {
		// Arrange / Act
		const text = render({ match: match({ status: 'finished' }) });

		// Assert
		expect(text()).toBe('--:--');
		expect(vi.getTimerCount()).toBe(0);
	});
});
