/**
 * Reading an organizer's key out of a shared link.
 *
 * The Choke app hands a spectator a URL like
 *   https://bjjscore.live/?npub=npub1…
 * so they never have to copy a key or hunt for the input box — landing on the
 * page IS loading the matches. This module is the receiving half: it pulls the
 * key out of the query string, and wipes it from the address bar afterwards so a
 * later refresh doesn't re-apply a link the viewer may have since navigated away
 * from (the key is persisted separately once it loads).
 */

/**
 * The one query param a key arrives under. There is deliberately no alias: one
 * name means nobody has to ask which one is canonical. The value may be an npub
 * or a 64-char hex string — decodePubkey() is what sorts that out, so this
 * module stays agnostic about the shape of what it hands back.
 */
export const SHARE_PUBKEY_PARAM = 'npub';

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
 * Remove the share param from the current address bar without a navigation or a
 * new history entry. No-op outside the browser (SSR / tests without a DOM).
 */
export function stripSharedPubkeyFromUrl(): void {
	if (typeof window === 'undefined') return;

	const url = new URL(window.location.href);
	if (!url.searchParams.has(SHARE_PUBKEY_PARAM)) return;

	url.searchParams.delete(SHARE_PUBKEY_PARAM);
	history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

/**
 * Build a share link for an origin + npub. The Choke app assembles the same URL
 * on its own side; the format lives here too so there is a single source of
 * truth and tests can round-trip it back through readSharedPubkey().
 */
export function buildShareLink(origin: string, npub: string): string {
	const url = new URL(origin);
	url.searchParams.set(SHARE_PUBKEY_PARAM, npub);
	return url.toString();
}
