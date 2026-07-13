import { writable } from 'svelte/store';
import type { MatchEvent, ViewMode } from './types.js';
import { MATCH_MAX_AGE_SECONDS } from './constants.js';

const STORAGE_KEY_PUBKEY = 'choke:organizer-pubkey';
const STORAGE_KEY_THEME = 'choke:theme';

/** Map of match id → MatchEvent, reactive store */
export const matchesMap = writable<Map<string, MatchEvent>>(new Map());

/** Current view mode */
export const viewMode = writable<ViewMode>('compact');

/** Whether debug mode is active */
export const debugMode = writable<boolean>(false);

/** Currently subscribed organizer pubkey (hex) */
export const activePubkey = writable<string>('');

/** Loading state for Nostr subscription */
export const isLoading = writable<boolean>(false);

/** Theme: 'dark' | 'light' */
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
 */
export function getSortedMatches(
	map: Map<string, MatchEvent>,
	nowSeconds: number = Math.floor(Date.now() / 1000)
): MatchEvent[] {
	const arr = Array.from(map.values()).filter((m) => isMatchFresh(m, nowSeconds));

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
