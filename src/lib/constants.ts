/** Matches older than this are ignored on ingest and hidden from the list */
export const MATCH_MAX_AGE_SECONDS = 86400;

/** How often the match list re-checks which matches have aged out */
export const MATCH_AGE_CHECK_INTERVAL_MS = 60_000;
