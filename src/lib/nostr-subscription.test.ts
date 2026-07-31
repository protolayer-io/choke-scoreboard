import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * EOSE needs a channel of its own.
 *
 * The signal already arrives — `subscribeToMatches` hands `oneose` to
 * SimplePool — but until now all it did was clear `isLoading`, which the
 * ten-second timeout clears too. A caller watching that boolean gets whichever
 * happened first and cannot tell them apart, and the two mean opposite things
 * to a shared match link: "the relays answered and do not have this" is settled,
 * while "nobody answered in ten seconds" is a guess a late arrival may still
 * overturn.
 *
 * These tests are about that distinction and nothing else. The relay is a stub;
 * what is under test is which store gets set by which event.
 */

const handlers: { oneose?: () => void; onevent?: (e: unknown) => void } = {};
const subscribeMany = vi.fn(
	(_relays: string[], _filter: unknown, h: { oneose?: () => void; onevent?: (e: unknown) => void }) => {
		handlers.oneose = h.oneose;
		handlers.onevent = h.onevent;
		return { close: vi.fn() };
	}
);

vi.mock('nostr-tools/pool', () => ({
	SimplePool: class {
		subscribeMany = subscribeMany;
		listConnectionStatus = () => new Map();
		close = vi.fn();
	}
}));

const { subscribeToMatches, closeSubscription } = await import('./nostr.js');
const { isLoading, relaysSettled } = await import('./stores.js');
const { MATCH_LINK_BACKSTOP_MS } = await import('./constants.js');

const PUBKEY = 'a'.repeat(64);

beforeEach(() => {
	vi.useFakeTimers();
	subscribeMany.mockClear();
	relaysSettled.set(false);
	isLoading.set(false);
});

afterEach(() => {
	closeSubscription();
	vi.useRealTimers();
});

describe('the settled signal', () => {
	it('starts unset — the relays have not answered a subscription that just opened', () => {
		relaysSettled.set(true);

		subscribeToMatches(PUBKEY);

		// Including on a watchdog rebuild: a stale `true` would let a match link
		// conclude the relays answered on a socket that is gone.
		expect(get(relaysSettled)).toBe(false);
	});

	it('is set by EOSE, and by nothing else', () => {
		subscribeToMatches(PUBKEY);
		expect(get(relaysSettled)).toBe(false);

		handlers.oneose?.();

		expect(get(relaysSettled)).toBe(true);
	});

	it('is NOT set by the ten-second timeout', () => {
		// This is the whole point. If the timeout set it too, the channel would be
		// `isLoading` again under a different name, and Pending could not end on
		// EOSE-with-no-event the way the spec requires.
		subscribeToMatches(PUBKEY);

		vi.advanceTimersByTime(MATCH_LINK_BACKSTOP_MS * 2);

		expect(get(relaysSettled)).toBe(false);
	});

	it('is cleared when the subscription is closed', () => {
		subscribeToMatches(PUBKEY);
		handlers.oneose?.();
		expect(get(relaysSettled)).toBe(true);

		closeSubscription();

		expect(get(relaysSettled)).toBe(false);
	});
});

describe('the loading flag, which is not the same statement', () => {
	it('is still cleared by EOSE', () => {
		subscribeToMatches(PUBKEY);
		expect(get(isLoading)).toBe(true);

		handlers.oneose?.();

		expect(get(isLoading)).toBe(false);
	});

	it('is still cleared by the timeout when EOSE never comes', () => {
		// The existing spinner behaviour has to survive the new channel: this is
		// what keeps the board's list from spinning forever behind a silent relay.
		subscribeToMatches(PUBKEY);
		expect(get(isLoading)).toBe(true);

		vi.advanceTimersByTime(MATCH_LINK_BACKSTOP_MS);

		expect(get(isLoading)).toBe(false);
		expect(get(relaysSettled)).toBe(false);
	});
});
