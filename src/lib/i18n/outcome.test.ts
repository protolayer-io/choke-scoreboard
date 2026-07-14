import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import { getOutcome } from '../scoring.js';
import type { MatchEvent } from '../types.js';
import { t } from './index.js';
import { formatOutcome } from './outcome.js';

/**
 * Phase 2 moved the words out of scoring.ts. These tests exist to prove nothing
 * else moved with them: every string below is what the board printed BEFORE the
 * refactor, character for character. A translation system that quietly reworded
 * the English on its way through would be the worst possible outcome — it would
 * look like it worked.
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

/** Say it the way a component does: read the translator, describe the match. */
function say(over: Partial<MatchEvent> = {}) {
	return formatOutcome(get(t), getOutcome(match(over)));
}

describe('saying how a match was won, in English, exactly as before', () => {
	it('names the submission', () => {
		expect(say({ winner: 'f2', method: 'submission', submission: 'armbar' })).toEqual({
			method: 'SUBMISSION',
			detail: 'Armbar'
		});
	});

	it('names a submission by the id on the wire, never printing the id', () => {
		expect(say({ winner: 'f2', method: 'submission', submission: 'rear_naked_choke' })).toEqual({
			method: 'SUBMISSION',
			detail: 'Rear naked choke'
		});
	});

	it('prints a submission nobody has a word for exactly as the referee typed it', () => {
		// No catalog holds a technique invented last week, and a board that showed
		// nothing there would hide the best thing that happened all day
		const said = say({ winner: 'f1', method: 'submission', submission: 'baratoplata' });

		expect(said.detail).toBe('baratoplata');
	});

	it('prints a technique named after something on Object.prototype', () => {
		// `submission` is free text from the referee, and it indexes a plain object.
		// A referee who types 'constructor' hits Object.prototype, the lookup comes
		// back truthy, and the fallback to their own words never runs — the wall
		// shows the word `undefined` in front of the room.
		for (const typed of ['constructor', 'toString', '__proto__']) {
			const said = say({ winner: 'f1', method: 'submission', submission: typed });

			expect(said.detail).toBe(typed);
		}
	});

	it('says a submission with no technique recorded', () => {
		expect(say({ winner: 'f2', method: 'submission' })).toEqual({
			method: 'SUBMISSION',
			detail: 'Submitted'
		});
	});

	it('says a disqualification, reason and all', () => {
		expect(
			say({ winner: 'f1', method: 'dq', dq_reason: 'technical_foul', dq_detail: 'knee reap' })
		).toEqual({ method: 'DISQUALIFICATION', detail: 'technical foul — knee reap' });
	});

	it('says a disqualification with no reason recorded', () => {
		expect(say({ winner: 'f1', method: 'dq' }).detail).toBe('disqualified');
	});

	it('says a forfeit', () => {
		expect(say({ winner: 'f1', method: 'forfeit' })).toEqual({
			method: 'FORFEIT',
			detail: 'Opponent withdrew'
		});
	});

	it('says the score', () => {
		expect(say({ f1_pt2: 1, method: 'points', winner: 'f1' })).toEqual({
			method: 'POINTS',
			detail: '2 × 0'
		});
	});

	it('says a match decided on advantages', () => {
		expect(say({ method: 'advantages', winner: 'f1', f1_adv: 1 })).toEqual({
			method: 'ADVANTAGE',
			detail: 'Tied 0 × 0 — decided on advantages'
		});
	});

	it('says a referee decision', () => {
		expect(say({ method: 'decision', winner: 'f1' }).detail).toBe('Tied 0 × 0 — referee decision');
	});

	it('says a draw', () => {
		expect(say({ method: 'draw' })).toEqual({ method: 'DRAW', detail: 'Tied 0 × 0' });
	});

	it('still describes a legacy event, which cannot describe itself', () => {
		expect(say({ f1_pt2: 1, ended_at: undefined })).toEqual({
			method: 'POINTS',
			detail: '2 × 0'
		});
	});
});
