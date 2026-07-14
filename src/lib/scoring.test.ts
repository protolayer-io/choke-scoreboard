import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	getF1EffectiveAdvantages,
	getF1EffectivePoints,
	getF2EffectivePoints,
	getLeader,
	getRemainingSeconds,
	getOutcome,
	getWinner,
	getWinnerName,
	isLegacyResult,
	isMatchPaused,
	isTimerWarning
} from './scoring.js';
import type { MatchEvent } from './types.js';

/**
 * A scoreboard is the one thing in this system that *only* reads. It cannot ask
 * the referee anything — so every mistake it makes is a mistake somebody watches
 * on a wall.
 *
 * The bug these tests exist for: Bob leads 4–0, Carlos armbars him, and a
 * scoreboard that derives the winner from the numbers announces **Bob, on
 * points**. Loudly, in the room.
 *
 * See choke/docs/specs/match-outcome.md.
 */
function match(over: Partial<MatchEvent> = {}): MatchEvent {
	return {
		id: 'abcd',
		status: 'finished',
		start_at: 1700000000,
		duration: 300,
		f1_name: 'Bob',
		f2_name: 'Carlos',
		f1_pt2: 0,
		f2_pt2: 0,
		f1_pt3: 0,
		f2_pt3: 0,
		f1_pt4: 0,
		f2_pt4: 0,
		f1_adv: 0,
		f2_adv: 0,
		f1_pen: 0,
		f2_pen: 0,
		ended_at: 1700000180,
		...over
	};
}

describe('the winner the event names', () => {
	it('beats the scoreboard on a submission', () => {
		// Arrange — Bob leads 4–0 and taps to an armbar
		const m = match({
			f1_pt4: 1,
			winner: 'f2',
			method: 'submission',
			submission: 'armbar'
		});

		// Assert — every number here favours Bob, and Carlos won. The event carries
		// the canonical id; the wall reads the name.
		expect(getF1EffectivePoints(m)).toBe(4);
		expect(getF2EffectivePoints(m)).toBe(0);
		expect(getWinner(m)).toBe(2);
		expect(getWinnerName(m)).toBe('Carlos');
		expect(m.submission).toBe('armbar');
		expect(getOutcome(m)).toEqual({
			method: 'submission',
			detail: { kind: 'submission', submission: 'armbar' }
		});
	});

	it('beats the scoreboard on a disqualification', () => {
		const m = match({
			f2_pt4: 1,
			winner: 'f1',
			method: 'dq',
			dq_reason: 'technical_foul',
			dq_detail: 'knee reap'
		});

		expect(getWinner(m)).toBe(1);
		expect(getOutcome(m)).toEqual({
			method: 'dq',
			detail: { kind: 'dq', reason: 'technical_foul', detail: 'knee reap' }
		});
	});

	it('names nobody on a draw', () => {
		// Arrange — a draw is a method with no winner, never a third winner value
		const m = match({ method: 'draw' });

		// Assert
		expect(getWinner(m)).toBe(0);
		expect(getWinnerName(m)).toBeNull();
		expect(getOutcome(m).method).toBe('draw');
	});

	it('names nobody while the match is still running', () => {
		expect(getWinner(match({ status: 'in-progress', f1_pt2: 1 }))).toBe(0);
	});

	it('reads the technique out loud, not its id', () => {
		// Arrange — the referee's app publishes canonical ids, so a Brazilian
		// tapping "chave de braço" and a Japanese referee tapping 腕十字固め produce
		// the SAME event. That is what makes counting armbars across a tournament
		// mean anything.
		const m = match({ winner: 'f2', method: 'submission', submission: 'rear_naked_choke' });

		// Assert — scoring carries the id and nothing else. What a room full of
		// people actually READS is chosen in i18n/outcome.ts, which is the only
		// place that knows the language — see outcome.test.ts.
		expect(getOutcome(m)).toEqual({
			method: 'submission',
			detail: { kind: 'submission', submission: 'rear_naked_choke' }
		});
	});

	it('prints a technique it has never heard of exactly as written', () => {
		// The field is free text on purpose. A board that blanked on a baratoplata
		// would be hiding the most interesting thing that happened all day.
		const m = match({ winner: 'f2', method: 'submission', submission: 'baratoplata' });

		expect(getOutcome(m).detail).toEqual({ kind: 'submission', submission: 'baratoplata' });
	});

	it('reports a submission with no technique recorded', () => {
		// Arrange — the technique is optional; a referee is never blocked from
		// ending a match because the app has never heard of a baratoplata
		const m = match({ winner: 'f2', method: 'submission' });

		expect(getOutcome(m)).toEqual({ method: 'submission', detail: { kind: 'submission' } });
	});
});

describe('the penalty ladder', () => {
	it('concedes an advantage on the second penalty', () => {
		const m = match({ status: 'in-progress', ended_at: undefined, f2_pen: 2 });

		expect(getF1EffectiveAdvantages(m)).toBe(1);
		expect(getF1EffectivePoints(m)).toBe(0);
	});

	it('concedes two points on the third', () => {
		const m = match({ status: 'in-progress', ended_at: undefined, f2_pen: 3 });

		expect(getF1EffectivePoints(m)).toBe(2);
		expect(getF1EffectiveAdvantages(m)).toBe(1);
	});

	it('adds nothing on the fourth — that is a disqualification, not arithmetic', () => {
		const third = match({ status: 'in-progress', ended_at: undefined, f2_pen: 3 });
		const fourth = match({ status: 'in-progress', ended_at: undefined, f2_pen: 4 });

		expect(getF1EffectivePoints(fourth)).toBe(getF1EffectivePoints(third));
	});

	it('leaves the raw counters alone', () => {
		// Arrange — Carlos's third penalty gives Bob two points
		const m = match({ f1_pt2: 1, f2_pen: 3 });

		// Assert — Bob is credited with them, and the record still says he scored
		// exactly one takedown. Folding them in would claim one he never scored.
		expect(getF1EffectivePoints(m)).toBe(4);
		expect(m.f1_pt2).toBe(1);
	});

	it('can hand the match to the fighter who was behind', () => {
		// Arrange — Carlos leads 4–2…
		const before = match({ f1_pt2: 1, f2_pt2: 2 });
		expect(getLeader(before)).toBe(2);

		// Act — …and takes a third penalty
		const after = match({ f1_pt2: 1, f2_pt2: 2, f2_pen: 3 });

		// Assert — 4–4 on points, and Bob's conceded advantage decides it
		expect(getF1EffectivePoints(after)).toBe(4);
		expect(getF2EffectivePoints(after)).toBe(4);
		expect(getLeader(after)).toBe(1);
	});
});

describe('the winner and the reason never contradict each other', () => {
	it('agrees when a penalty-conceded advantage decides a level match', () => {
		// Arrange — a match with no method recorded, level on effective points,
		// and decided only by the advantage Carlos's second penalty conceded.
		const m = match({ f1_pt2: 1, f2_pt2: 1, f2_pen: 2 });
		expect(getF1EffectivePoints(m)).toBe(getF2EffectivePoints(m));
		expect(getF1EffectiveAdvantages(m)).toBe(1);

		// Assert — the board must not name Bob the winner and then announce the
		// match "decided on advantages" for Carlos. Comparing raw advantages
		// here (0–0) would have called it a DRAW while getWinner named Bob.
		expect(getWinner(m)).toBe(1);
		expect(getOutcome(m).method).toBe('advantages');
	});
});

describe('penalties are never a tiebreak of their own', () => {
	it('a level match stays level, whatever the penalty counts', () => {
		// Arrange — level on effective points and advantages; Carlos has one
		// penalty, which concedes nothing.
		const m = match({ f2_pen: 1 });

		// Assert — the old scoreboard broke this tie "on fewer penalties". Doing
		// that now would count the same penalty twice: a fighter whose third
		// penalty had already handed two points away would lose *again* for the
		// count.
		expect(getLeader(m)).toBe(0);
	});
});

describe('legacy events are not re-refereed', () => {
	it('keeps the arithmetic the old app showed', () => {
		// Arrange — published before outcomes existed: Carlos won 4–2 while he
		// carried three penalties, and the app that refereed it applied none of
		// their consequences.
		const legacy = match({ f1_pt2: 1, f2_pt2: 2, f2_pen: 3, ended_at: undefined });

		// Assert — reading it with the ladder would make it 4–4, send it to
		// advantages, and flip the winner. Rewriting a result nobody re-refereed
		// is not a scoreboard's call.
		expect(isLegacyResult(legacy)).toBe(true);
		expect(getF1EffectivePoints(legacy)).toBe(2);
		expect(getF2EffectivePoints(legacy)).toBe(4);
		expect(getWinner(legacy)).toBe(2);
	});

	it('still describes them, because they cannot describe themselves', () => {
		const legacy = match({ f1_pt2: 1, ended_at: undefined });

		expect(getOutcome(legacy)).toEqual({
			method: 'points',
			detail: { kind: 'score', top: 2, bottom: 0 }
		});
	});

	it('a live match is never legacy, whatever it carries', () => {
		// Arrange — the scoreboard must show the penalty turning into points
		// *while* the match is being refereed, exactly as the referee's app does
		const live = match({ status: 'in-progress', ended_at: undefined, f2_pen: 3 });

		expect(isLegacyResult(live)).toBe(false);
		expect(getF1EffectivePoints(live)).toBe(2);
	});
});

/**
 * A paused match is still `in-progress` — the referee's app only adds
 * `paused_at`. Read that as the clock: while it is set the match is not being
 * fought, and a wall showing time still draining is showing a lie the whole
 * room can check against the referee standing still.
 */
describe('the clock while the referee has it stopped', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	/** Pretend the wall clock reads `seconds` unix seconds. */
	function nowIs(seconds: number): void {
		vi.useFakeTimers();
		vi.setSystemTime(seconds * 1000);
	}

	it('freezes at the second the referee paused, not at now', () => {
		// Arrange — started at :000, paused 97s in, and a further minute of real
		// time has passed with the fighters standing still
		nowIs(1700000160);
		const m = match({ status: 'in-progress', start_at: 1700000000, paused_at: 1700000097 });

		// Act
		const remaining = getRemainingSeconds(m);

		// Assert — 300 − 97, and not 300 − 160
		expect(isMatchPaused(m)).toBe(true);
		expect(remaining).toBe(203);
	});

	it('does not drain while the pause holds', () => {
		nowIs(1700000160);
		const m = match({ status: 'in-progress', start_at: 1700000000, paused_at: 1700000097 });
		const first = getRemainingSeconds(m);

		// Act — ten more seconds of real time, same event
		nowIs(1700000170);

		// Assert
		expect(getRemainingSeconds(m)).toBe(first);
	});

	it('runs against the wall clock again once the pause is gone', () => {
		// Arrange — the app republishes without paused_at when it resumes
		nowIs(1700000160);
		const m = match({ status: 'in-progress', start_at: 1700000000 });

		// Assert
		expect(isMatchPaused(m)).toBe(false);
		expect(getRemainingSeconds(m)).toBe(140);
	});

	it('warns from the frozen clock, not the running one', () => {
		// Arrange — paused with 20s left, and real time is long past the end
		nowIs(1700000400);
		const m = match({ status: 'in-progress', start_at: 1700000000, paused_at: 1700000280 });

		// Assert — 20s left is the warning zone; read at now it would be expired
		expect(getRemainingSeconds(m)).toBe(20);
		expect(isTimerWarning(m)).toBe(true);
	});

	it('never counts a match that is not running as paused', () => {
		// Arrange — a stale paused_at riding along on a finished event
		const over = match({ status: 'finished', paused_at: 1700000097 });

		// Assert — status governs; a finished match is over, not on hold
		expect(isMatchPaused(over)).toBe(false);
		expect(getRemainingSeconds(over)).toBe(0);
	});
});
