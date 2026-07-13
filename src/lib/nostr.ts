import { SimplePool } from 'nostr-tools/pool';
import { nip19 } from 'nostr-tools';
import type { MatchEvent, MatchStatus } from './types.js';
import { upsertMatch, isLoading } from './stores.js';
import { MATCH_MAX_AGE_SECONDS } from './constants.js';
import type { SubCloser } from 'nostr-tools/abstract-pool';

/** BJJ Match event kind (parameterized replaceable) */
const MATCH_EVENT_KIND = 31415;

/** Default relay list */
const DEFAULT_RELAYS = [
	'wss://relay.mostro.network'
];

let pool: SimplePool | null = null;
let activeSubCloser: SubCloser | null = null;

/**
 * Encode a hex pubkey to npub format.
 */
export function encodePubkey(hex: string): string {
	return nip19.npubEncode(hex);
}

/**
 * Decode an npub or hex pubkey string to hex.
 * Throws if the input is invalid.
 */
export function decodePubkey(input: string): string {
	const trimmed = input.trim();

	if (trimmed.startsWith('npub')) {
		try {
			const decoded = nip19.decode(trimmed);
			if (decoded.type === 'npub') {
				return decoded.data;
			}
		} catch {
			throw new Error('Invalid npub format');
		}
	}

	// Validate hex pubkey (64 hex chars)
	if (/^[0-9a-f]{64}$/i.test(trimmed)) {
		return trimmed.toLowerCase();
	}

	throw new Error('Invalid pubkey: must be npub or 64-char hex');
}

/**
 * Parse a Nostr event into a MatchEvent.
 * Returns null if parsing fails.
 */
function parseMatchEvent(event: {
	kind: number;
	content: string;
	created_at: number;
	pubkey: string;
	tags: string[][];
}): MatchEvent | null {
	try {
		const data = JSON.parse(event.content);

		// Extract d-tag for match id
		const dTag = event.tags.find((t) => t[0] === 'd');
		const matchId = dTag?.[1] ?? data.id;

		if (!matchId) return null;

		const validStatuses: MatchStatus[] = ['waiting', 'in-progress', 'finished', 'canceled'];
		const status = validStatuses.includes(data.status) ? data.status : 'waiting';

		return {
			id: matchId,
			status,
			start_at: data.start_at ? Number(data.start_at) : undefined,
			duration: Number(data.duration) || 300,
			f1_name: String(data.f1_name || 'Fighter 1'),
			f2_name: String(data.f2_name || 'Fighter 2'),
			f1_color: data.f1_color || undefined,
			f2_color: data.f2_color || undefined,
			f1_pt2: Number(data.f1_pt2) || 0,
			f2_pt2: Number(data.f2_pt2) || 0,
			f1_pt3: Number(data.f1_pt3) || 0,
			f2_pt3: Number(data.f2_pt3) || 0,
			f1_pt4: Number(data.f1_pt4) || 0,
			f2_pt4: Number(data.f2_pt4) || 0,
			f1_adv: Number(data.f1_adv) || 0,
			f2_adv: Number(data.f2_adv) || 0,
			f1_pen: Number(data.f1_pen) || 0,
			f2_pen: Number(data.f2_pen) || 0,
			created_at: event.created_at,
			pubkey: event.pubkey
		};
	} catch {
		console.error('Failed to parse match event:', event.content);
		return null;
	}
}

/**
 * Subscribe to match events from a specific organizer pubkey.
 * Automatically deduplicates by match id, keeping the newest created_at.
 */
export function subscribeToMatches(pubkeyHex: string): void {
	// Clean up existing subscription
	closeSubscription();

	pool = new SimplePool();
	isLoading.set(true);

	const since = Math.floor(Date.now() / 1000) - MATCH_MAX_AGE_SECONDS;

	const sub = pool.subscribeMany(
		DEFAULT_RELAYS,
		{
			kinds: [MATCH_EVENT_KIND],
			authors: [pubkeyHex],
			since,
			limit: 1000
		},
		{
			onevent(event) {
				// Relays may ignore `since`, so enforce the window client-side too
				if (event.created_at < since) return;

				const match = parseMatchEvent(event);
				if (match) {
					upsertMatch(match);
				}
			},
			oneose() {
				isLoading.set(false);
			}
		}
	);

	activeSubCloser = sub;

	// Set loading to false after timeout in case EOSE never fires
	setTimeout(() => {
		isLoading.set(false);
	}, 10000);
}

/**
 * Close active subscription and pool connections.
 */
export function closeSubscription(): void {
	if (activeSubCloser) {
		activeSubCloser.close();
		activeSubCloser = null;
	}
	if (pool) {
		pool.close(DEFAULT_RELAYS);
		pool = null;
	}
}
