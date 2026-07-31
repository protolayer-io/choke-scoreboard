/** Matches older than this are ignored on ingest and hidden from the list */
export const MATCH_MAX_AGE_SECONDS = 86400;

/** How often the match list re-checks which matches have aged out */
export const MATCH_AGE_CHECK_INTERVAL_MS = 60_000;

/**
 * How long to keep waiting for a named match before saying it is not there.
 *
 * A relay that never sends EOSE would otherwise leave a shared match link
 * spinning forever, so this is the backstop: whichever comes first, the settled
 * signal or this timer, ends the wait.
 *
 * The number is normative and shared with the Choke app, so two people opening
 * the same link on different platforms wait the same length of time and reach
 * the same screen. It is ONE constant and not two because the subscription
 * already gave up on EOSE after exactly this long — inventing a second timeout a
 * couple of seconds away from the existing one would buy nothing and leave two
 * magic numbers where there was one.
 */
export const MATCH_LINK_BACKSTOP_MS = 10_000;

/**
 * Where the app itself lives. Every live page links here: the board on a gym
 * wall is seen by a room full of people who have never heard of it, and the
 * link is the only thing that turns one of them into the next organizer.
 */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=io.protolayer.choke';

/** The name every live page credits. A domain, so it is never translated. */
export const BRAND_NAME = 'bjjscore.live';
