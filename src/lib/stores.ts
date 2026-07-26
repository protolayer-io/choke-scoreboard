import { writable } from 'svelte/store';
import type { MatchEvent, MatchStatus, ViewMode } from './types.js';
import { MATCH_MAX_AGE_SECONDS } from './constants.js';

/**
 * Every status the board can show, in the order the list sorts them: what is
 * live, then what is next, then what is over. This is the full menu the status
 * filter offers.
 */
export const ALL_MATCH_STATUSES: readonly MatchStatus[] = [
	'in-progress',
	'waiting',
	'finished',
	'canceled'
];

/**
 * What the filter shows before anyone touches it: the matches happening and the
 * matches about to happen. Finished and canceled ones are hidden by default so a
 * live wall is not buried under the day's results — the operator opts into them.
 */
export const DEFAULT_STATUS_FILTER: readonly MatchStatus[] = ['waiting', 'in-progress'];

const STORAGE_KEY_PUBKEY = 'choke:organizer-pubkey';

/** Map of match id → MatchEvent, reactive store */
export const matchesMap = writable<Map<string, MatchEvent>>(new Map());

/** Current view mode */
export const viewMode = writable<ViewMode>('compact');

/**
 * Which statuses the match list shows. Starts at DEFAULT_STATUS_FILTER —
 * waiting and in-progress — so a fresh visit sees only what is live or coming
 * up, never the finished pile. Toggling a status replaces the set (a new
 * reference) rather than mutating it, so subscribers actually re-run.
 */
export const statusFilter = writable<Set<MatchStatus>>(new Set(DEFAULT_STATUS_FILTER));

/** Turn one status on or off in the filter, returning a fresh set. */
export function toggleStatusFilter(status: MatchStatus): void {
	statusFilter.update((current) => {
		const next = new Set(current);
		if (next.has(status)) {
			next.delete(status);
		} else {
			next.add(status);
		}
		return next;
	});
}

/** Whether debug mode is active */
export const debugMode = writable<boolean>(false);

/** Currently subscribed organizer pubkey (hex) */
export const activePubkey = writable<string>('');

/** Loading state for Nostr subscription */
export const isLoading = writable<boolean>(false);

/**
 * Theme: 'dark' | 'light'.
 *
 * Lives here because half the app reads it; everything that CHANGES it — the
 * toggle, the memory of it, the class on <html> — is in `theme.ts`.
 */
export const theme = writable<'dark' | 'light'>('dark');

/** Save organizer pubkey to localStorage */
export function persistPubkey(hex: string): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY_PUBKEY, hex);
	}
}

/** Load saved organizer pubkey from localStorage */
export function loadPersistedPubkey(): string | null {
	if (typeof localStorage !== 'undefined') {
		return localStorage.getItem(STORAGE_KEY_PUBKEY);
	}
	return null;
}

/** Clear saved organizer pubkey from localStorage */
export function clearPersistedPubkey(): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(STORAGE_KEY_PUBKEY);
	}
}

/**
 * Upsert a match into the store.
 * Only replaces if the new event has a newer created_at.
 */
export function upsertMatch(match: MatchEvent): void {
	matchesMap.update((map) => {
		const existing = map.get(match.id);
		if (!existing || (match.created_at ?? 0) >= (existing.created_at ?? 0)) {
			map.set(match.id, match);
		}
		return new Map(map); // new reference for reactivity
	});
}

/** Clear all matches */
export function clearMatches(): void {
	matchesMap.set(new Map());
}

/**
 * Whether a match is still inside the visible age window.
 * Matches outside it must not be rendered anywhere.
 */
export function isMatchFresh(
	match: MatchEvent | undefined,
	nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
	if (!match) return false;
	return (match.created_at ?? 0) >= nowSeconds - MATCH_MAX_AGE_SECONDS;
}

/**
 * Get sorted matches array (in-progress first, then by created_at desc).
 * Matches older than MATCH_MAX_AGE_SECONDS are excluded, so they drop off the
 * list as they age even while the page stays open.
 *
 * When `allowedStatuses` is passed, only matches whose status is in the set are
 * returned — an empty set shows nothing. Omit it (or pass undefined) to keep the
 * old behaviour of showing every fresh match.
 */
export function getSortedMatches(
	map: Map<string, MatchEvent>,
	nowSeconds: number = Math.floor(Date.now() / 1000),
	allowedStatuses?: ReadonlySet<MatchStatus>
): MatchEvent[] {
	const arr = Array.from(map.values()).filter(
		(m) => isMatchFresh(m, nowSeconds) && (!allowedStatuses || allowedStatuses.has(m.status))
	);

	const statusOrder: Record<string, number> = {
		'in-progress': 0,
		waiting: 1,
		finished: 2,
		canceled: 3
	};

	return arr.sort((a, b) => {
		const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
		if (statusDiff !== 0) return statusDiff;
		return (b.created_at ?? 0) - (a.created_at ?? 0);
	});
}
