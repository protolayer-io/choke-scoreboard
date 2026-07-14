import { describe, expect, it } from 'vitest';

import {
	getF1EffectiveAdvantages,
	getF1EffectivePoints,
	getF2EffectivePoints,
	getLeader,
	getWinMethod,
	getWinner,
	getWinnerName,
	isLegacyResult
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

		// Assert — every number here favours Bob, and Carlos won
		expect(getF1EffectivePoints(m)).toBe(4);
		expect(getF2EffectivePoints(m)).toBe(0);
		expect(getWinner(m)).toBe(2);
		expect(getWinnerName(m)).toBe('Carlos');
		expect(getWinMethod(m)).toEqual({ method: 'SUBMISSION', detail: 'armbar' });
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
		expect(getWinMethod(m)).toEqual({
			method: 'DISQUALIFICATION',
			detail: 'technical foul — knee reap'
		});
	});

	it('names nobody on a draw', () => {
		// Arrange — a draw is a method with no winner, never a third winner value
		const m = match({ method: 'draw' });

		// Assert
		expect(getWinner(m)).toBe(0);
		expect(getWinnerName(m)).toBeNull();
		expect(getWinMethod(m).method).toBe('DRAW');
	});

	it('names nobody while the match is still running', () => {
		expect(getWinner(match({ status: 'in-progress', f1_pt2: 1 }))).toBe(0);
	});

	it('reports a submission with no technique recorded', () => {
		// Arrange — the technique is optional; a referee is never blocked from
		// ending a match because the app has never heard of a baratoplata
		const m = match({ winner: 'f2', method: 'submission' });

		expect(getWinMethod(m)).toEqual({ method: 'SUBMISSION', detail: 'Submitted' });
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

		expect(getWinMethod(legacy)).toEqual({ method: 'POINTS', detail: '2 × 0' });
	});

	it('a live match is never legacy, whatever it carries', () => {
		// Arrange — the scoreboard must show the penalty turning into points
		// *while* the match is being refereed, exactly as the referee's app does
		const live = match({ status: 'in-progress', ended_at: undefined, f2_pen: 3 });

		expect(isLegacyResult(live)).toBe(false);
		expect(getF1EffectivePoints(live)).toBe(2);
	});
});
