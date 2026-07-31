/** Matches older than this are ignored on ingest and hidden from the list */
export const MATCH_MAX_AGE_SECONDS = 86400;

/** How often the match list re-checks which matches have aged out */
export const MATCH_AGE_CHECK_INTERVAL_MS = 60_000;

/**
 * Where the app itself lives. Every live page links here: the board on a gym
 * wall is seen by a room full of people who have never heard of it, and the
 * link is the only thing that turns one of them into the next organizer.
 */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=io.protolayer.choke';

/** The name every live page credits. A domain, so it is never translated. */
export const BRAND_NAME = 'bjjscore.live';
