/**
 * Core data model for a BJJ match event received from Nostr.
 *
 * This represents a single match in a tournament. All scoring fields
 * are counts of specific point-value moves, not raw point totals.
 *
 * Total score = pt2 * 2 + pt3 * 3 + pt4 * 4
 */
export interface MatchEvent {
	/** Unique match identifier (maps to Nostr d-tag) */
	id: string;
	/** Current state of the match */
	status: MatchStatus;
	/** Unix timestamp (seconds) when the match started */
	start_at?: number;
	/** Match duration in seconds (default 300 = 5 minutes) */
	duration: number;
	/** Fighter 1 display name */
	f1_name: string;
	/** Fighter 2 display name */
	f2_name: string;
	/** Fighter 1 gi/panel color */
	f1_color?: string;
	/** Fighter 2 gi/panel color */
	f2_color?: string;
	/** Fighter 1 count of 2-point moves (takedown, sweep) */
	f1_pt2: number;
	/** Fighter 2 count of 2-point moves */
	f2_pt2: number;
	/** Fighter 1 count of 3-point moves (guard pass) */
	f1_pt3: number;
	/** Fighter 2 count of 3-point moves */
	f2_pt3: number;
	/** Fighter 1 count of 4-point moves (mount, back take) */
	f1_pt4: number;
	/** Fighter 2 count of 4-point moves */
	f2_pt4: number;
	/** Fighter 1 advantages */
	f1_adv: number;
	/** Fighter 2 advantages */
	f2_adv: number;
	/** Fighter 1 penalties */
	f1_pen: number;
	/** Fighter 2 penalties */
	f2_pen: number;

	// ─── Outcome ────────────────────────────────────────────────────────────
	//
	// How the match was won. The scoreboard cannot say on its own: a fighter can
	// lead 4–0 and still lose to an armbar. These fields are ABSENT from every
	// event published before they existed, so every consumer must tolerate that
	// forever — see isLegacyResult() in scoring.ts.

	/** Who won. Absent while unfinished, when canceled, and on a draw. */
	winner?: MatchWinner;
	/** How they won. Absent on events published before outcomes existed. */
	method?: MatchMethod;
	/** The submission, as free text: 'armbar'. Only with method 'submission'. */
	submission?: string;
	/** Why the loser was disqualified. Required with method 'dq'. */
	dq_reason?: DqReason;
	/** What the disqualified fighter did: 'knee reap'. Free text. */
	dq_detail?: string;
	/** Unix seconds when the match actually ended. */
	ended_at?: number;

	/** Nostr event created_at timestamp */
	created_at?: number;
	/** Nostr event author pubkey (hex) */
	pubkey?: string;
}

export type MatchStatus = 'waiting' | 'in-progress' | 'finished' | 'canceled';

/** Who won. A draw is `method: 'draw'` with no winner, never a third value. */
export type MatchWinner = 'f1' | 'f2';

/**
 * How a match was won.
 *
 * `submission`, `dq` and `forfeit` BEAT THE SCOREBOARD: the winner is whoever
 * `winner` says, whatever the numbers show. The rest are the scoreboard.
 *
 * There is no `penalties`. Penalties already became advantages and points (see
 * the effective score in scoring.ts), so using them again as a tiebreak would
 * count the same penalty twice.
 */
export type MatchMethod =
	| 'submission'
	| 'points'
	| 'advantages'
	| 'decision'
	| 'dq'
	| 'forfeit'
	| 'draw';

/**
 * Why a fighter was disqualified.
 *
 * The categories are standard; the infractions are not — whether a knee reap is
 * illegal depends on ruleset, belt and age division — so what actually happened
 * lives in `dq_detail` as free text.
 */
export type DqReason = 'accumulated_penalties' | 'technical_foul' | 'disciplinary_foul';

export type ViewMode = 'compact' | 'broadcast';

export interface AppConfig {
	pubkey: string;
	viewMode: ViewMode;
	debugMode: boolean;
}
