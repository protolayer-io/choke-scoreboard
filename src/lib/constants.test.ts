import { describe, expect, it } from 'vitest';

import { MATCH_LINK_BACKSTOP_MS, MATCH_MAX_AGE_SECONDS } from './constants.js';

/**
 * This looks like a test of a literal against itself. It is not.
 *
 * MATCH_MAX_AGE_SECONDS is half of a cross-repo agreement: the Choke app holds
 * the same 86400 in `scoreboardMaxAgeSeconds`, and both readers measure the
 * same way — the event's `created_at` against the same boundary — so a given
 * shared link is Resolved in both readers or Unresolved in both, and never one
 * of each. A recipient who opens a link on the web and then on their phone must
 * not see the match in one and an expired notice in the other; that reads as one
 * of the two being broken, and neither is.
 *
 * Its only job is to fail a build when someone changes the window here without
 * changing it there, instead of the drift surfacing as a support question
 * months later. See docs/shared-links.md §5.
 */
describe('the shared-link window, as a cross-repo obligation', () => {
	it('is 24 hours, the same number the Choke app holds', () => {
		expect(MATCH_MAX_AGE_SECONDS).toBe(86400);
	});
});

/**
 * The backstop is normative too, and for the same reason: two people opening
 * the same link on different platforms wait the same length of time and reach
 * the same screen.
 */
describe('the wait before a link gives up', () => {
	it('is the ten seconds both readers agree on', () => {
		expect(MATCH_LINK_BACKSTOP_MS).toBe(10_000);
	});
});
