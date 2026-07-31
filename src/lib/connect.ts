import { subscribeToMatches } from './nostr.js';
import { activePubkey, clearMatches, debugMode, persistPubkey } from './stores.js';

/**
 * Point the app at one organizer: forget the last one's matches, remember this
 * key, and open the subscription.
 *
 * It lives here rather than inside PubkeyInput because it now has two callers.
 * The input is one; the other is the root page resolving a shared match link,
 * which cannot go through the input at all — in that mode the input is not on
 * screen, because the whole viewport is the match the link named.
 */
export function connectToPubkey(hex: string): void {
	clearMatches();
	debugMode.set(false);
	activePubkey.set(hex);
	persistPubkey(hex);
	subscribeToMatches(hex);
}
