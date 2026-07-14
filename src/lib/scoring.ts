import type { DqReason, MatchEvent, MatchMethod } from './types.js';

/**
 * Calculate total score for a fighter.
 * Total = pt2 * 2 + pt3 * 3 + pt4 * 4
 */
export function calculateScore(pt2: number, pt3: number, pt4: number): number {
	return pt2 * 2 + pt3 * 3 + pt4 * 4;
}

/** Get Fighter 1's total score */
export function getF1Score(match: MatchEvent): number {
	return calculateScore(match.f1_pt2, match.f1_pt3, match.f1_pt4);
}

/** Get Fighter 2's total score */
export function getF2Score(match: MatchEvent): number {
	return calculateScore(match.f2_pt2, match.f2_pt3, match.f2_pt4);
}

/**
 * True for a match that ended before outcomes existed: finished (or canceled),
 * and silent about how.
 *
 * Such an event was refereed by an app that applied no penalty consequences at
 * all, so applying them now would REWRITE A RESULT THAT HAS ALREADY BEEN SEEN —
 * a match won 2–0 while the loser carried three penalties becomes 2–2, goes to
 * advantages, and can flip. Leaving an old result showing the scoreboard it
 * showed at the time is at worst incomplete; rewriting it asserts something new
 * about a match nobody re-refereed.
 *
 * The test is `ended_at`, not `method`: a match the app ends always stamps it,
 * even in the one case where it cannot yet name a method (the fighters are
 * level, and that is the referees' to call).
 *
 * A match still in progress is never legacy — it has no result to preserve.
 */
export function isLegacyResult(match: MatchEvent): boolean {
	return (
		match.ended_at === undefined &&
		(match.status === 'finished' || match.status === 'canceled')
	);
}

/**
 * The IBJJF penalty ladder: the opponent's 3rd penalty concedes two points.
 *
 * The 4th adds nothing to the arithmetic — it is a disqualification, and only a
 * referee may call one, so it arrives as `method: 'dq'` or not at all.
 */
function penaltyPoints(match: MatchEvent, opponentPenalties: number): number {
	if (isLegacyResult(match)) return 0;
	return opponentPenalties >= 3 ? 2 : 0;
}

/** The opponent's 2nd penalty concedes an advantage. */
function penaltyAdvantages(match: MatchEvent, opponentPenalties: number): number {
	if (isLegacyResult(match)) return 0;
	return opponentPenalties >= 2 ? 1 : 0;
}

/**
 * Points fighter 1 has, INCLUDING those the opponent's penalties conceded.
 *
 * The raw counters stay raw: `f1_pt2` still means "takedowns fighter 1 scored".
 * The conceded points are derived, never folded in — folding them would claim a
 * takedown that never happened.
 */
export function getF1EffectivePoints(match: MatchEvent): number {
	return getF1Score(match) + penaltyPoints(match, match.f2_pen);
}

export function getF2EffectivePoints(match: MatchEvent): number {
	return getF2Score(match) + penaltyPoints(match, match.f1_pen);
}

export function getF1EffectiveAdvantages(match: MatchEvent): number {
	return match.f1_adv + penaltyAdvantages(match, match.f2_pen);
}

export function getF2EffectiveAdvantages(match: MatchEvent): number {
	return match.f2_adv + penaltyAdvantages(match, match.f1_pen);
}

/**
 * Who is ahead on the scoreboard, or 0 when the fighters are level.
 *
 * Two rungs, and then it stops being arithmetic: more effective points, then
 * more effective advantages. A level match has NO WINNER IN THE DATA — the
 * referees decide, and they say so with `method: 'decision'` or `'draw'`.
 *
 * Penalties are NOT a third rung. They are already inside the points and
 * advantages being compared, so using the raw count again would count the same
 * penalty twice — a fighter whose third penalty had already handed two points
 * away could then lose AGAIN for having the higher count.
 */
export function getLeader(match: MatchEvent): 0 | 1 | 2 {
	const p1 = getF1EffectivePoints(match);
	const p2 = getF2EffectivePoints(match);
	if (p1 !== p2) return p1 > p2 ? 1 : 2;

	const a1 = getF1EffectiveAdvantages(match);
	const a2 = getF2EffectiveAdvantages(match);
	if (a1 !== a2) return a1 > a2 ? 1 : 2;

	return 0;
}

/**
 * Who actually won: 1, 2, or 0 for nobody (a draw, or an undecided match).
 *
 * The event says so outright when it can. THAT IS THE ONLY THING WORTH
 * BELIEVING: a fighter can lead 4–0 and lose to an armbar, and every number on
 * this scoreboard will still favour the loser.
 *
 * Only a legacy result — which cannot say — falls back to the scoreboard.
 */
export function getWinner(match: MatchEvent): 0 | 1 | 2 {
	if (match.status !== 'finished') return 0;

	if (match.winner) return match.winner === 'f1' ? 1 : 2;
	if (match.method) return 0; // a draw: stated, and nobody won

	return getLeader(match); // legacy: the scoreboard is all there is
}

/**
 * How the match was decided, in the only terms this module is allowed to hold:
 * ids and numbers.
 *
 * It used to hand back finished English — `Tied 4 × 0 — decided on advantages` —
 * and a room reading Spanish got it anyway. Scoring knows WHAT happened; only
 * the view knows what language to say it in. So this reports what happened, and
 * i18n/outcome.ts says it out loud.
 *
 * `submission` and a dq's `detail` are free text from the referee and travel
 * exactly as they were typed: they are the one part of an outcome that no
 * catalog can ever hold, because BJJ invents submissions faster than any list.
 */
export type OutcomeDetail =
	| { kind: 'submission'; submission?: string }
	| { kind: 'score'; top: number; bottom: number }
	| { kind: 'tied'; top: number; bottom: number }
	| { kind: 'tiedAdvantages'; top: number; bottom: number }
	| { kind: 'tiedDecision'; top: number; bottom: number }
	| { kind: 'dq'; reason?: DqReason; detail?: string }
	| { kind: 'forfeit' };

export interface MatchOutcome {
	/** The wire id, never a label: 'submission', not 'SUBMISSION'. */
	method: MatchMethod;
	detail: OutcomeDetail;
}

/**
 * Describe how a finished match was decided.
 *
 * It used to derive this from the scoreboard, because "Nostr events carry no
 * explicit method field". They do now — and deriving it is exactly how a
 * scoreboard announces the loser of a submission as the winner ON POINTS.
 *
 * A legacy event still has to be guessed at, because it genuinely says nothing.
 */
export function getOutcome(match: MatchEvent): MatchOutcome {
	const p1 = getF1EffectivePoints(match);
	const p2 = getF2EffectivePoints(match);
	const top = Math.max(p1, p2);
	const bottom = Math.min(p1, p2);

	const method = match.method;
	if (method) {
		return { method, detail: describeMethod(match, method, top, bottom) };
	}

	// No outcome recorded. Say what the scoreboard says, and nothing more.
	//
	// The advantages compared here are the *effective* ones — the same numbers
	// getLeader() and getWinner() use. Comparing the raw ones would let this
	// function announce "decided on advantages" for one fighter while getWinner
	// named the other, which is the scoreboard contradicting itself on a wall.
	if (p1 !== p2) return { method: 'points', detail: { kind: 'score', top, bottom } };

	const a1 = getF1EffectiveAdvantages(match);
	const a2 = getF2EffectiveAdvantages(match);
	if (a1 !== a2) {
		return { method: 'advantages', detail: { kind: 'tiedAdvantages', top, bottom } };
	}
	return { method: 'draw', detail: { kind: 'tied', top, bottom } };
}

function describeMethod(
	match: MatchEvent,
	method: MatchMethod,
	top: number,
	bottom: number
): OutcomeDetail {
	switch (method) {
		case 'submission':
			return { kind: 'submission', submission: match.submission };
		case 'points':
			return { kind: 'score', top, bottom };
		case 'advantages':
			return { kind: 'tiedAdvantages', top, bottom };
		case 'decision':
			return { kind: 'tiedDecision', top, bottom };
		case 'dq':
			return { kind: 'dq', reason: match.dq_reason, detail: match.dq_detail };
		case 'forfeit':
			return { kind: 'forfeit' };
		case 'draw':
			return { kind: 'tied', top, bottom };
	}
}

/** The winner's name, or null when nobody won. */
export function getWinnerName(match: MatchEvent): string | null {
	const winner = getWinner(match);
	if (winner === 0) return null;
	return winner === 1 ? match.f1_name : match.f2_name;
}

/**
 * Whether the referee has the clock stopped.
 *
 * A paused match is still `in-progress`, so the status alone cannot say it:
 * only `paused_at` can. It means nothing on a match that is not running.
 */
export function isMatchPaused(match: MatchEvent): boolean {
	return match.status === 'in-progress' && typeof match.paused_at === 'number' && match.paused_at > 0;
}

/**
 * Calculate remaining time in seconds for an in-progress match.
 * Returns 0 if time has expired.
 *
 * While the match is paused the clock is read at `paused_at` rather than at
 * now, so the wall shows the time the referee stopped it at.
 */
export function getRemainingSeconds(match: MatchEvent): number {
	if (match.status !== 'in-progress' || !match.start_at) return 0;

	const clock = isMatchPaused(match) ? (match.paused_at as number) : Math.floor(Date.now() / 1000);
	const endTime = match.start_at + match.duration;
	const remaining = endTime - clock;

	return Math.max(0, remaining);
}

/**
 * Format seconds into MM:SS string.
 */
export function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get display time for a match based on its status.
 */
export function getDisplayTime(match: MatchEvent): string {
	switch (match.status) {
		case 'waiting':
			return formatTime(match.duration);
		case 'in-progress':
			return formatTime(getRemainingSeconds(match));
		case 'finished':
		case 'canceled':
			return '--:--';
	}
}

/**
 * Check if timer is in warning zone (last 30 seconds).
 */
export function isTimerWarning(match: MatchEvent): boolean {
	if (match.status !== 'in-progress') return false;
	const remaining = getRemainingSeconds(match);
	return remaining > 0 && remaining <= 30;
}
