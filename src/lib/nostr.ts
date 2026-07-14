import { SimplePool } from 'nostr-tools/pool';
import { nip19 } from 'nostr-tools';
import type { DqReason, MatchEvent, MatchMethod, MatchStatus, MatchWinner } from './types.js';
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

/** Pubkey of the live subscription, so the watchdog knows what to restore */
let currentPubkey = '';
let watchdogHandle: ReturnType<typeof setInterval> | null = null;
let lastSubscribeAt = 0;

/** How often to check that the relay connection is still alive */
const WATCHDOG_INTERVAL_MS = 15_000;

/** Give a fresh subscription time to connect before the watchdog judges it dead */
const WATCHDOG_GRACE_MS = 20_000;

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
const METHODS: MatchMethod[] = [
	'submission',
	'points',
	'advantages',
	'decision',
	'dq',
	'forfeit',
	'draw'
];

const DQ_REASONS: DqReason[] = [
	'accumulated_penalties',
	'technical_foul',
	'disciplinary_foul'
];

function parseWinner(value: unknown): MatchWinner | undefined {
	return value === 'f1' || value === 'f2' ? value : undefined;
}

/**
 * A method we do not recognise comes back undefined — a future client may
 * publish one we have never heard of, and a scoreboard that threw the whole
 * event away over it would show nothing at all.
 *
 * That is safe because `winner` is the authoritative field: an event we cannot
 * *describe* still names the fighter who won, and the board will still name
 * them.
 */
function parseMethod(value: unknown): MatchMethod | undefined {
	return METHODS.includes(value as MatchMethod) ? (value as MatchMethod) : undefined;
}

function parseDqReason(value: unknown): DqReason | undefined {
	return DQ_REASONS.includes(value as DqReason) ? (value as DqReason) : undefined;
}

/** Free text, or nothing. An empty string is nothing. */
function parseText(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

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

			// The pause. A paused match is still 'in-progress' and carries nothing
			// else to say so, so dropping this field here leaves the board draining
			// time in front of a referee standing still — however right the clock
			// arithmetic downstream is.
			paused_at: data.paused_at ? Number(data.paused_at) : undefined,
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

			// The outcome. Dropping these on the floor — which is what building the
			// object field by field quietly did — makes every modern event look
			// like a legacy one, and the scoreboard goes right back to announcing
			// the loser of a submission as the winner on points.
			winner: parseWinner(data.winner),
			method: parseMethod(data.method),
			submission: parseText(data.submission),
			dq_reason: parseDqReason(data.dq_reason),
			dq_detail: parseText(data.dq_detail),
			ended_at: data.ended_at !== undefined ? Number(data.ended_at) : undefined,

			created_at: event.created_at,
			pubkey: event.pubkey
		};
	} catch {
		console.error('Failed to parse match event:', event.content);
		return null;
	}
}

/** True when we have no pool, or any relay in it is not connected. */
function hasDeadRelay(): boolean {
	if (!pool) return true;

	const statuses = Array.from(pool.listConnectionStatus().values());
	if (statuses.length < DEFAULT_RELAYS.length) return true;

	return statuses.some((connected) => !connected);
}

/**
 * Re-subscribe if the relay connection has dropped.
 *
 * nostr-tools retries on its own, but it gives up permanently once a retry
 * fails (its `ws.onerror` sets skipReconnection), which is exactly what happens
 * when a machine wakes before the network is back. This is the backstop: it
 * rebuilds the subscription from scratch whenever the socket is not connected.
 */
function ensureSubscribed(): void {
	if (!currentPubkey) return;
	if (Date.now() - lastSubscribeAt < WATCHDOG_GRACE_MS) return;
	if (!hasDeadRelay()) return;

	subscribeToMatches(currentPubkey, { showLoading: false });
}

function handleVisibilityChange(): void {
	if (document.visibilityState === 'visible') ensureSubscribed();
}

function startWatchdog(): void {
	if (typeof window === 'undefined') return;

	watchdogHandle = setInterval(ensureSubscribed, WATCHDOG_INTERVAL_MS);
	// A dropped connection is most likely to be noticed exactly when the network
	// returns or the user comes back to the tab, so react to those immediately
	// instead of waiting out the interval.
	window.addEventListener('online', ensureSubscribed);
	document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopWatchdog(): void {
	if (typeof window === 'undefined') return;

	if (watchdogHandle) {
		clearInterval(watchdogHandle);
		watchdogHandle = null;
	}
	window.removeEventListener('online', ensureSubscribed);
	document.removeEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Subscribe to match events from a specific organizer pubkey.
 * Automatically deduplicates by match id, keeping the newest created_at.
 *
 * Stays subscribed across dropped connections: the pool pings and reconnects,
 * and a watchdog rebuilds the subscription if that fails.
 */
export function subscribeToMatches(
	pubkeyHex: string,
	{ showLoading = true }: { showLoading?: boolean } = {}
): void {
	// Clean up existing subscription
	closeSubscription();

	currentPubkey = pubkeyHex;
	lastSubscribeAt = Date.now();

	// enablePing keeps the socket alive (and detects silently dropped ones);
	// enableReconnect re-opens it and refires the REQ. Both default to false, and
	// without them a closed socket leaves the page listening to nothing until reload.
	pool = new SimplePool({ enablePing: true, enableReconnect: true });

	// A reconnect must not blank out the matches already on screen behind a spinner.
	if (showLoading) isLoading.set(true);

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
	startWatchdog();

	// Set loading to false after timeout in case EOSE never fires
	setTimeout(() => {
		isLoading.set(false);
	}, 10000);
}

/**
 * Close active subscription and pool connections.
 */
export function closeSubscription(): void {
	stopWatchdog();
	currentPubkey = '';

	if (activeSubCloser) {
		activeSubCloser.close();
		activeSubCloser = null;
	}
	if (pool) {
		pool.close(DEFAULT_RELAYS);
		pool = null;
	}
}

/** Exposed for tests: the parser is where the outcome enters the app. */
export const __parseMatchEventForTests = parseMatchEvent;
