import type { MatchOutcome } from '../scoring.js';
import type { DqReason, MatchMethod } from '../types.js';
import type { MessageKey, Translate } from './index.js';

/**
 * Say an outcome out loud.
 *
 * scoring.ts reports what happened as ids and numbers; this is where it becomes
 * words, in whatever language the room is reading. Everything scoring.ts used to
 * assemble with template literals now goes THROUGH a message, so a translator
 * owns the word order — down to the dash.
 */

/** Wire id → message key. The ids never move; only what we say for them does. */
const METHOD_KEYS = {
	submission: 'method.submission',
	points: 'method.points',
	advantages: 'method.advantages',
	decision: 'method.decision',
	dq: 'method.dq',
	forfeit: 'method.forfeit',
	draw: 'method.draw'
} as const satisfies Record<MatchMethod, MessageKey>;

const DQ_KEYS = {
	accumulated_penalties: 'dq.accumulated_penalties',
	technical_foul: 'dq.technical_foul',
	disciplinary_foul: 'dq.disciplinary_foul'
} as const satisfies Record<DqReason, MessageKey>;

/**
 * The submissions we have a word for.
 *
 * The ids that are NOT in here are the point of it: a referee can type any
 * technique at all, and one nobody has a key for still has to reach the wall.
 */
const SUBMISSION_KEYS: Record<string, MessageKey> = {
	armbar: 'submission.armbar',
	rear_naked_choke: 'submission.rear_naked_choke',
	triangle: 'submission.triangle',
	guillotine: 'submission.guillotine',
	kimura: 'submission.kimura',
	americana: 'submission.americana',
	cross_collar_choke: 'submission.cross_collar_choke',
	bow_and_arrow: 'submission.bow_and_arrow',
	ezekiel: 'submission.ezekiel',
	omoplata: 'submission.omoplata',
	arm_triangle: 'submission.arm_triangle',
	north_south_choke: 'submission.north_south_choke',
	straight_ankle_lock: 'submission.straight_ankle_lock',
	heel_hook: 'submission.heel_hook',
	toe_hold: 'submission.toe_hold'
};

/**
 * A submission's name, for a wall.
 *
 * A technique with no key comes back **exactly as the referee typed it**. That
 * is deliberate: the field is free text because BJJ invents submissions faster
 * than any list can hold them, and a board that blanked on a baratoplata would
 * be hiding the most interesting thing that happened all day.
 */
function submissionLabel(t: Translate, submission: string): string {
	// Object.hasOwn, and not a truthiness check on the lookup: `submission` is
	// free text typed by a referee, and a plain object answers for every key on
	// Object.prototype. A referee typing 'constructor' or 'toString' gets a truthy
	// *function* back, never reaches the fallback below, and puts the word
	// `undefined` on a wall in front of the room.
	if (!Object.hasOwn(SUBMISSION_KEYS, submission)) return submission;

	return t(SUBMISSION_KEYS[submission] as 'submission.armbar');
}

export function formatOutcome(
	t: Translate,
	outcome: MatchOutcome
): { method: string; detail: string } {
	return {
		method: t(METHOD_KEYS[outcome.method]),
		detail: formatDetail(t, outcome)
	};
}

function formatDetail(t: Translate, { detail }: MatchOutcome): string {
	switch (detail.kind) {
		case 'submission':
			return detail.submission ? submissionLabel(t, detail.submission) : t('outcome.submitted');
		case 'score':
			return t('outcome.score', detail.top, detail.bottom);
		case 'tied':
			return t('outcome.tied', detail.top, detail.bottom);
		case 'tiedAdvantages':
			return t('outcome.tiedAdvantages', detail.top, detail.bottom);
		case 'tiedDecision':
			return t('outcome.tiedDecision', detail.top, detail.bottom);
		case 'dq': {
			// The reason is ours to translate; what the fighter actually DID is the
			// referee's own words ('knee reap') and stays in them. Two languages side
			// by side is unavoidable — the join between them is not, so it is a message.
			const reason = detail.reason
				? t(DQ_KEYS[detail.reason] as 'dq.technical_foul')
				: t('outcome.disqualified');
			return detail.detail ? t('outcome.dqDetail', reason, detail.detail) : reason;
		}
		case 'forfeit':
			return t('outcome.forfeit');
	}
}
