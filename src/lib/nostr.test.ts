import { describe, expect, it } from 'vitest';

import { __parseMatchEventForTests as parseMatchEvent } from './nostr.js';
import { getWinner, getWinnerName, isLegacyResult } from './scoring.js';

/**
 * The gap that made every other test in this project a lie.
 *
 * `scoring.ts` was correct, and its tests passed — because they built
 * `MatchEvent` objects by hand. The parser, meanwhile, constructed the object
 * field by field and never read the outcome at all. So against a real relay
 * every modern event arrived stripped of its winner, looked like a legacy one,
 * and the board went right back to announcing the loser of a submission as the
 * winner on points.
 *
 * The logic was tested. The pipeline was not. These tests are the pipeline.
 */
function event(content: Record<string, unknown>) {
	return {
		kind: 31415,
		content: JSON.stringify({
			id: 'abcd',
			status: 'finished',
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
			...content
		}),
		created_at: 1700000200,
		pubkey: 'f'.repeat(64),
		tags: [['d', 'abcd']]
	};
}

describe('parsing an outcome off the wire', () => {
	it('carries a submission through, winner and all', () => {
		// Arrange — Bob leads 4–0 on the wire, and lost
		const parsed = parseMatchEvent(
			event({
				f1_pt4: 1,
				winner: 'f2',
				method: 'submission',
				submission: 'armbar',
				ended_at: 1700000180
			})
		)!;

		// Assert — this is the end-to-end case: relay JSON in, correct winner out
		expect(parsed.winner).toBe('f2');
		expect(parsed.method).toBe('submission');
		expect(parsed.submission).toBe('armbar');
		expect(parsed.ended_at).toBe(1700000180);
		expect(isLegacyResult(parsed)).toBe(false);
		expect(getWinner(parsed)).toBe(2);
		expect(getWinnerName(parsed)).toBe('Carlos');
	});

	it('carries a disqualification through', () => {
		const parsed = parseMatchEvent(
			event({
				winner: 'f1',
				method: 'dq',
				dq_reason: 'technical_foul',
				dq_detail: 'knee reap',
				ended_at: 1700000180
			})
		)!;

		expect(parsed.method).toBe('dq');
		expect(parsed.dq_reason).toBe('technical_foul');
		expect(parsed.dq_detail).toBe('knee reap');
	});

	it('leaves a legacy event exactly as legacy', () => {
		// Arrange — an event published before outcomes existed
		const parsed = parseMatchEvent(event({ f1_pt2: 1 }))!;

		expect(parsed.winner).toBeUndefined();
		expect(parsed.method).toBeUndefined();
		expect(parsed.ended_at).toBeUndefined();
		expect(isLegacyResult(parsed)).toBe(true);
	});

	it('still names the winner of a method it has never heard of', () => {
		// Arrange — a future client publishing something we do not understand.
		// Throwing the event away would show nothing at all; `winner` is the
		// authoritative field, so the board still names the right fighter — it
		// just cannot describe how they won.
		const parsed = parseMatchEvent(
			event({ winner: 'f2', method: 'telepathy', ended_at: 1700000180 })
		)!;

		expect(parsed.method).toBeUndefined();
		expect(getWinner(parsed)).toBe(2);
	});

	it('refuses a winner that is not a fighter', () => {
		const parsed = parseMatchEvent(event({ winner: 'f3', ended_at: 1700000180 }))!;

		expect(parsed.winner).toBeUndefined();
	});

	it('treats blank free text as absent', () => {
		const parsed = parseMatchEvent(
			event({ winner: 'f1', method: 'submission', submission: '   ', ended_at: 1700000180 })
		)!;

		expect(parsed.submission).toBeUndefined();
	});
});
