/**
 * Reading a shared link out of the query string.
 *
 * The Choke app hands a spectator a URL like
 *   https://bjjscore.live/?npub=npub1…            a board link
 *   https://bjjscore.live/?npub=npub1…&match=abcd a match link
 * so they never have to copy a key or hunt for the input box — landing on the
 * page IS loading the matches. This module is the receiving half.
 *
 * It is deliberately all pure functions over a search string, plus the one
 * address-bar write. Everything about *waiting* for the match to arrive lives
 * in the view; everything about what a legal link looks like lives here, so the
 * contract this repo shares with the app has exactly one home and its tests
 * pin it in both directions.
 *
 * See docs/shared-links.md — §1 is normative and shared between the two repos.
 */

/**
 * The one query param a key arrives under. There is deliberately no alias: one
 * name means nobody has to ask which one is canonical. The value may be an npub
 * or a 64-char hex string — decodePubkey() is what sorts that out, so this
 * module stays agnostic about the shape of what it hands back.
 */
export const SHARE_PUBKEY_PARAM = 'npub';

/**
 * The one query param a match id arrives under.
 *
 * `match=` and not `id=`: this URL gets pasted into group chats and will outlive
 * the code that reads it, and the day the site gains event or tournament pages
 * a bare `id` would have to be disambiguated by whatever else happens to be in
 * the query string — with the old links already in the wild. And no alias, for
 * the same reason `npub` has none.
 */
export const SHARE_MATCH_PARAM = 'match';

/**
 * The normative grammar, identical in both repos: four lowercase hex
 * characters, which is exactly what the app's Match._generateMatchId() emits.
 */
const MATCH_ID_PATTERN = /^[0-9a-f]{4}$/;

/**
 * The organizer key carried by a query string, or null if none is present.
 *
 * Returns the raw value untouched (only trimmed): validation and npub→hex
 * decoding are decodePubkey()'s job, so a malformed link surfaces the very same
 * error a bad paste would, in the viewer's language.
 */
export function readSharedPubkey(search: string): string | null {
	const value = new URLSearchParams(search).get(SHARE_PUBKEY_PARAM)?.trim();
	return value ? value : null;
}

/**
 * The match id carried by a query string, normalised, or null if there is none
 * or it fails the grammar.
 *
 * Validation applies to the DECODED value, in this order:
 *
 *     decoded value -> trim surrounding whitespace -> lowercase -> /^[0-9a-f]{4}$/
 *
 * Decoded, not raw: URLSearchParams percent-decodes before a caller ever sees
 * the value, exactly as Uri.queryParameters does in the app, and reading the raw
 * query string to get underneath that would be fighting the platform for no
 * gain. Builders emit lowercase and unencoded; readers accept a little more than
 * that on purpose, because chat clients and auto-capitalising keyboards mangle
 * links on the way — which is the same reason the npub reader trims.
 *
 * Trimming is of SURROUNDING whitespace only. Nothing else is normalised: no
 * stripping of interior separators, no aliasing of visually similar glyphs. A
 * value that still fails the pattern makes the link broken, and broken is not
 * the same thing as an id the feed does not contain.
 */
export function readSharedMatchId(search: string): string | null {
	const raw = new URLSearchParams(search).get(SHARE_MATCH_PARAM);
	if (raw === null) return null;

	const normalized = raw.trim().toLowerCase();
	return MATCH_ID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * What a query string turned out to be.
 *
 * - `none` — no match param. A board link, or no link at all; the existing
 *   pubkey path handles it and nothing here changes.
 * - `broken` — a match was named and cannot be looked up: the id failed the
 *   grammar, or there is no organizer to look it up under. Kept apart from
 *   "the feed does not have it" on purpose: conflating them tells the recipient
 *   the match ended when in fact the URL arrived damaged.
 * - `match` — an organizer and a well-formed id. Whether the feed HAS it is a
 *   later question, and not this module's.
 */
export type SharedMatchLink =
	| { kind: 'none' }
	| { kind: 'broken' }
	| { kind: 'match'; pubkey: string; matchId: string };

/**
 * Read a match link out of a query string.
 *
 * The pubkey is handed back exactly as readSharedPubkey() found it — an npub or
 * a hex key, undecoded — so a malformed key still fails in the one place that
 * knows how to say so.
 */
export function readSharedMatchLink(search: string): SharedMatchLink {
	const params = new URLSearchParams(search);
	if (!params.has(SHARE_MATCH_PARAM)) return { kind: 'none' };

	const matchId = readSharedMatchId(search);
	const pubkey = readSharedPubkey(search);

	// A match id is only unique within one author's events, so an id alone names
	// nothing — and there would be nobody to subscribe to.
	if (!matchId || !pubkey) return { kind: 'broken' };

	return { kind: 'match', pubkey, matchId };
}

/**
 * Remove the shared link from the current address bar without a navigation or a
 * new history entry. No-op outside the browser (SSR / tests without a DOM).
 *
 * Both params go together, or neither goes. A match id left behind after the
 * pubkey has been stripped is a match with no author — the broken form above —
 * and it is what a viewer refreshes from or forwards to somebody else.
 *
 * WHEN this is called is as load-bearing as what it deletes, and it is the
 * caller's business: a board link may be stripped on sight because the key is
 * persisted the moment it is read, but a match link must survive until
 * resolution completes. Nothing persists a match id, so stripping it early
 * throws away the thing a retry, a reconnect or a late-arriving event still
 * needs — and leaves the address bar holding half a link for the whole time the
 * viewer is waiting.
 */
export function stripSharedLinkFromUrl(): void {
	if (typeof window === 'undefined') return;

	const url = new URL(window.location.href);
	const hasPubkey = url.searchParams.has(SHARE_PUBKEY_PARAM);
	const hasMatch = url.searchParams.has(SHARE_MATCH_PARAM);
	if (!hasPubkey && !hasMatch) return;

	url.searchParams.delete(SHARE_PUBKEY_PARAM);
	url.searchParams.delete(SHARE_MATCH_PARAM);
	history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

/**
 * Build a share link for an origin, an npub and optionally one match. The Choke
 * app assembles the same URL on its own side; the format lives here too so
 * there is a single source of truth and the tests can round-trip it back
 * through the readers.
 *
 * The path is always the root. A path-shaped `/match/abcd` reads better and is
 * the wrong answer: the Android app claims `/` and nothing else in its App
 * Links intent filter, so a deeper path would open the browser on precisely the
 * devices that have the app installed.
 *
 * There is no share button on the web — sharing happens in the app, which is
 * the device holding the match. This is a format definition the tests
 * round-trip, not a UI affordance.
 */
export function buildShareLink(origin: string, npub: string, matchId?: string): string {
	const url = new URL(origin);
	url.pathname = '/';
	url.searchParams.set(SHARE_PUBKEY_PARAM, npub);
	if (matchId) url.searchParams.set(SHARE_MATCH_PARAM, matchId.trim().toLowerCase());
	return url.toString();
}
