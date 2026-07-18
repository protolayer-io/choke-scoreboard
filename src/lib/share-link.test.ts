import { describe, expect, it } from 'vitest';

import { buildShareLink, readSharedPubkey, SHARE_PUBKEY_PARAMS } from './share-link.js';

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

	it('reads a value from the ?pubkey= alias', () => {
		expect(readSharedPubkey(`?pubkey=${HEX}`)).toBe(HEX);
	});

	it('prefers npub over pubkey when both are present', () => {
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

describe('buildShareLink', () => {
	it('round-trips through readSharedPubkey', () => {
		const link = buildShareLink('https://bjjscore.live/', NPUB);
		const search = new URL(link).search;
		expect(readSharedPubkey(search)).toBe(NPUB);
	});

	it('uses the primary npub param', () => {
		const link = buildShareLink('https://bjjscore.live/', NPUB);
		expect(new URL(link).searchParams.get(SHARE_PUBKEY_PARAMS[0])).toBe(NPUB);
	});
});
