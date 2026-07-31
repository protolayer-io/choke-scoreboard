// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
	buildShareLink,
	readSharedMatchId,
	readSharedMatchLink,
	readSharedPubkey,
	SHARE_MATCH_PARAM,
	SHARE_PUBKEY_PARAM,
	stripSharedLinkFromUrl
} from './share-link.js';

/**
 * A shared link is the whole point of the feature: a spectator opens
 * bjjscore.live/?npub=… and the board is already watching the right organizer,
 * with no key to paste. These tests pin the query contract both directions —
 * what we read out, and what buildShareLink() writes so the Choke app and this
 * reader can never drift apart.
 */

const NPUB = 'npub14e8x7ggcvgy4j0wcsqh6kv4pfmtax7rkryenux9u7ytemjcuce7q9qpjtk';
const HEX = 'ae4e6f2118c209593dd8805f566540ed7be9bc3b0c99f30c2f3c8bcee58c633e';

describe('readSharedPubkey', () => {
	it('reads an npub from ?npub=', () => {
		expect(readSharedPubkey(`?npub=${NPUB}`)).toBe(NPUB);
	});

	it('reads a 64-char hex key from ?npub= too — decoding is not this job', () => {
		expect(readSharedPubkey(`?npub=${HEX}`)).toBe(HEX);
	});

	it('ignores ?pubkey=, which is not a share param', () => {
		expect(readSharedPubkey(`?pubkey=${HEX}`)).toBeNull();
	});

	it('ignores ?pubkey= even alongside a real npub', () => {
		expect(readSharedPubkey(`?pubkey=${HEX}&npub=${NPUB}`)).toBe(NPUB);
	});

	it('trims surrounding whitespace', () => {
		expect(readSharedPubkey(`?npub=%20${NPUB}%20`)).toBe(NPUB);
	});

	it('returns the raw value without validating — decoding is the caller job', () => {
		expect(readSharedPubkey('?npub=not-a-key')).toBe('not-a-key');
	});

	it('returns null when no share param is present', () => {
		expect(readSharedPubkey('?foo=bar')).toBeNull();
		expect(readSharedPubkey('')).toBeNull();
	});

	it('returns null for an empty param value', () => {
		expect(readSharedPubkey('?npub=')).toBeNull();
	});
});

/**
 * The match id's grammar is NORMATIVE and shared with the Choke app: four
 * lowercase hex characters, checked against the DECODED value after trimming
 * and lower-casing, and nothing else normalised. Builders emit exactly that;
 * readers accept slightly more because chat clients and auto-capitalising
 * keyboards mangle links on the way. These cases are the table in
 * docs/shared-links.md §1, one test each, because they are the only thing
 * stopping the two repos from drifting apart.
 */
describe('readSharedMatchId', () => {
	it('reads the canonical four-hex form a builder emits', () => {
		expect(readSharedMatchId('?match=abcd')).toBe('abcd');
	});

	it('accepts a percent-encoded value, because the query parser decodes first', () => {
		expect(readSharedMatchId('?match=%61%62%63%64')).toBe('abcd');
	});

	it('accepts and trims surrounding whitespace', () => {
		expect(readSharedMatchId('?match=abcd%20')).toBe('abcd');
		expect(readSharedMatchId('?match=%20abcd')).toBe('abcd');
	});

	it('accepts an upper-cased id and hands back the lowercase one', () => {
		// An auto-capitalising keyboard is not the sender naming a different match.
		expect(readSharedMatchId('?match=ABCD')).toBe('abcd');
		expect(readSharedMatchId('?match=AbCd')).toBe('abcd');
	});

	it('rejects a value of the wrong length', () => {
		expect(readSharedMatchId('?match=abc')).toBeNull();
		expect(readSharedMatchId('?match=abcde')).toBeNull();
	});

	it('rejects non-hex characters', () => {
		expect(readSharedMatchId('?match=zzzz')).toBeNull();
	});

	it('rejects an id carrying a separator — nothing but trim and lowercase is normalised', () => {
		expect(readSharedMatchId('?match=ab-cd')).toBeNull();
		expect(readSharedMatchId('?match=ab%20cd')).toBeNull();
	});

	it('returns null when there is no match param at all', () => {
		expect(readSharedMatchId(`?npub=${NPUB}`)).toBeNull();
		expect(readSharedMatchId('')).toBeNull();
	});

	it('returns null for an empty match param', () => {
		expect(readSharedMatchId('?match=')).toBeNull();
	});

	it('ignores ?id=, which is not a share param — there is no alias', () => {
		expect(readSharedMatchId('?id=abcd')).toBeNull();
	});
});

/**
 * A link that fails the grammar is BROKEN, and broken is not the same state as
 * a well-formed id the feed does not contain. Telling a recipient the match
 * ended when the URL arrived damaged is a different lie, and the one they will
 * blame the sender for.
 */
describe('readSharedMatchLink', () => {
	it('names an organizer and a match when both are readable', () => {
		expect(readSharedMatchLink(`?npub=${NPUB}&match=abcd`)).toEqual({
			kind: 'match',
			pubkey: NPUB,
			matchId: 'abcd'
		});
	});

	it('normalises the id it hands back', () => {
		expect(readSharedMatchLink(`?npub=${NPUB}&match=%20ABCD%20`)).toEqual({
			kind: 'match',
			pubkey: NPUB,
			matchId: 'abcd'
		});
	});

	it('is not a match link when there is no match param — that is a board link', () => {
		expect(readSharedMatchLink(`?npub=${NPUB}`)).toEqual({ kind: 'none' });
		expect(readSharedMatchLink('')).toEqual({ kind: 'none' });
	});

	it('is broken when the id is unreadable, even with a good organizer', () => {
		expect(readSharedMatchLink(`?npub=${NPUB}&match=zzzz`)).toEqual({ kind: 'broken' });
	});

	it('is broken when there is a match but no organizer to look it up under', () => {
		// A match id is only unique inside one author's events, so an id alone
		// names nothing and there is nobody to subscribe to.
		expect(readSharedMatchLink('?match=abcd')).toEqual({ kind: 'broken' });
	});

	it('is broken when the organizer param is present but empty', () => {
		expect(readSharedMatchLink('?npub=&match=abcd')).toEqual({ kind: 'broken' });
	});
});

/**
 * Stripping: both params go together, or neither goes. Half a link in the
 * address bar — a match id with no author — is exactly the broken form above,
 * and it is what a viewer refreshes or forwards.
 */
describe('stripSharedLinkFromUrl', () => {
	beforeEach(() => {
		history.replaceState(null, '', '/');
	});

	it('takes the organizer and the match out together', () => {
		history.replaceState(null, '', `/?npub=${NPUB}&match=abcd`);

		stripSharedLinkFromUrl();

		expect(window.location.search).toBe('');
	});

	it('never leaves a match id behind without its author', () => {
		history.replaceState(null, '', `/?npub=${NPUB}&match=abcd&lang=es`);

		stripSharedLinkFromUrl();

		expect(new URLSearchParams(window.location.search).has(SHARE_MATCH_PARAM)).toBe(false);
		expect(new URLSearchParams(window.location.search).has(SHARE_PUBKEY_PARAM)).toBe(false);
	});

	it('strips a match id whose grammar was broken, rather than stranding it', () => {
		history.replaceState(null, '', `/?npub=${NPUB}&match=zzzz`);

		stripSharedLinkFromUrl();

		expect(window.location.search).toBe('');
	});

	it('leaves every other param exactly where it was', () => {
		history.replaceState(null, '', `/?lang=es&npub=${NPUB}&match=abcd`);

		stripSharedLinkFromUrl();

		expect(window.location.search).toBe('?lang=es');
	});

	it('still strips a board link that carries no match', () => {
		history.replaceState(null, '', `/?npub=${NPUB}`);

		stripSharedLinkFromUrl();

		expect(window.location.search).toBe('');
	});

	it('does nothing at all when there is no shared link in the bar', () => {
		history.replaceState(null, '', '/?lang=es');

		stripSharedLinkFromUrl();

		expect(window.location.search).toBe('?lang=es');
	});
});

describe('buildShareLink', () => {
	it('round-trips through readSharedPubkey', () => {
		const link = buildShareLink('https://bjjscore.live/', NPUB);
		const search = new URL(link).search;
		expect(readSharedPubkey(search)).toBe(NPUB);
	});

	it('writes the key under the one share param', () => {
		const link = buildShareLink('https://bjjscore.live/', NPUB);
		expect(new URL(link).searchParams.get(SHARE_PUBKEY_PARAM)).toBe(NPUB);
	});

	it('carries a match id when it is given one, and round-trips that too', () => {
		const link = buildShareLink('https://bjjscore.live/', NPUB, 'abcd');
		const search = new URL(link).search;

		expect(readSharedMatchLink(search)).toEqual({
			kind: 'match',
			pubkey: NPUB,
			matchId: 'abcd'
		});
	});

	it('keeps the root path — the app claims / and nothing else', () => {
		// bjjscore.live/match/abcd would open the browser on a device that has the
		// app, which is the single outcome App Links exists to prevent.
		expect(new URL(buildShareLink('https://bjjscore.live/', NPUB, 'abcd')).pathname).toBe('/');
	});

	it('emits the id lowercase and unencoded — every legal character is URL-safe', () => {
		const link = buildShareLink('https://bjjscore.live/', NPUB, 'ABCD');
		expect(link).toContain('match=abcd');
	});

	it('omits the match param entirely when no id is given', () => {
		const link = buildShareLink('https://bjjscore.live/', NPUB);
		expect(new URL(link).searchParams.has(SHARE_MATCH_PARAM)).toBe(false);
	});
});
