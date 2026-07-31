// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A shared match link, from the recipient's side.
 *
 * Someone was sent "watch my son's fight" as a URL and tapped it. Everything
 * here is about the seconds between that tap and an answer, because that is the
 * part a spec can get wrong in ways nobody notices until a tournament: the
 * message is fine, the link is fine, and the recipient is looking at
 * "Match not found" for a fight that is happening in front of them.
 *
 * The transport is mocked out entirely. These tests are about the three states
 * and the rules that move between them — not about relays.
 */

vi.mock('$app/paths', () => ({ base: '' }));

const connectToPubkey = vi.fn();
vi.mock('$lib/connect.js', () => ({ connectToPubkey: (hex: string) => connectToPubkey(hex) }));

const HomePage = (await import('./+page.svelte')).default;
const { activePubkey, matchesMap, relaysSettled, sharedMatchView } = await import(
	'$lib/stores.js'
);
const { translate } = await import('$lib/i18n/index.js');
const { MATCH_LINK_BACKSTOP_MS } = await import('$lib/constants.js');
type MatchEvent = import('$lib/types.js').MatchEvent;

const NPUB = 'npub14e8x7ggcvgy4j0wcsqh6kv4pfmtax7rkryenux9u7ytemjcuce7q9qpjtk';
/**
 * What NPUB actually decodes to. Pinned rather than computed, so a test that
 * resolves by author is not comparing decodePubkey() against itself.
 */
const HEX = 'ae4e6f21186209593dd8802fab32a14ed7d3787619333e18bcf1179dcb1cc67c';
/** A second organizer, so an id can collide across two authors. */
const OTHER_HEX = 'b'.repeat(64);
const MATCH_ID = 'abcd';

function match(over: Partial<MatchEvent> = {}): MatchEvent {
	const now = Math.floor(Date.now() / 1000);
	return {
		id: MATCH_ID,
		status: 'in-progress',
		start_at: now - 60,
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
		created_at: now,
		pubkey: HEX,
		...over
	};
}

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

/** Open the page at a URL, the way tapping a link in a chat client does. */
function open(search: string) {
	history.replaceState(null, '', `/${search}`);
	component = mount(HomePage, { target, props: {} });
	flushSync();
	return () => target.innerHTML;
}

/**
 * A message in the current language. `Translate` is overloaded so that keys
 * carrying values keep their arguments; every key used here is a plain one, and
 * the cast is what lets them be passed as a variable instead of a literal.
 */
type MessageKey = import('$lib/i18n/index.js').MessageKey;
function say(key: MessageKey): string {
	return (translate() as unknown as (k: MessageKey) => string)(key);
}

beforeEach(() => {
	vi.useFakeTimers();
	target = document.createElement('div');
	document.body.appendChild(target);
	matchesMap.set(new Map());
	relaysSettled.set(false);
	activePubkey.set('');
	connectToPubkey.mockClear();
	localStorage.clear();
});

afterEach(() => {
	if (component) unmount(component);
	component = null;
	target.remove();
	matchesMap.set(new Map());
	relaysSettled.set(false);
	sharedMatchView.set(false);
	history.replaceState(null, '', '/');
	vi.useRealTimers();
});

/**
 * Pending is the state the whole feature turns on. Without it, the happy path —
 * a live match, a working link, a relay half a second away — opens on
 * "Match not found", which is the precise opposite of what the link promised.
 */
describe('while the feed has not answered yet', () => {
	it('says it is loading the match, not that there is no such match', () => {
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);

		expect(html()).toContain(say('match.pendingBody'));
		expect(html()).not.toContain(say('match.expiredBody'));
		expect(html()).not.toContain(say('match.notFoundTitle'));
	});

	it('subscribes to the organizer the link named', () => {
		open(`?npub=${NPUB}&match=${MATCH_ID}`);

		expect(connectToPubkey).toHaveBeenCalledWith(HEX);
	});

	it('does not pitch the app at somebody who is two seconds from the match', () => {
		// The dead-end pitch is for a journey that ended. Flashing it under a
		// spinner pitches the app and then takes it away again.
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);

		expect(html()).not.toContain(say('cta.deadEndPitch'));
	});

	it('leaves the whole link in the address bar, so a refresh re-applies it', () => {
		// Nothing persists a match id. Stripping now would throw away the only copy
		// of what the viewer was sent, and leave `?match=` with no `?npub=` — the
		// broken form — for the entire wait.
		open(`?npub=${NPUB}&match=${MATCH_ID}`);

		const params = new URLSearchParams(window.location.search);
		expect(params.get('npub')).toBe(NPUB);
		expect(params.get('match')).toBe(MATCH_ID);
	});

	it('gives up the whole viewport — no header, no footer around a match', () => {
		open(`?npub=${NPUB}&match=${MATCH_ID}`);

		let broadcast = false;
		sharedMatchView.subscribe((v) => (broadcast = v))();
		expect(broadcast).toBe(true);
	});
});

describe('when the match is there', () => {
	it('shows the fight, and never the dead end', () => {
		matchesMap.set(new Map([[MATCH_ID, match()]]));

		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);

		expect(html()).toContain('Bob');
		expect(html()).toContain('Carlos');
		expect(html()).not.toContain(say('match.pendingBody'));
	});

	it('takes the whole link out of the address bar together', () => {
		matchesMap.set(new Map([[MATCH_ID, match()]]));

		open(`?npub=${NPUB}&match=${MATCH_ID}&lang=es`);

		// Both, or neither. Half a link is the broken form, and it is what a viewer
		// refreshes from or forwards.
		expect(window.location.search).toBe('?lang=es');
	});
});

/**
 * Pending ends on EOSE-with-no-matching-event OR the ten-second backstop,
 * whichever comes first. Neither alone is sufficient — which is why EOSE needed
 * a channel of its own instead of being folded into the loading boolean.
 */
describe('ending the wait', () => {
	it('ends the moment the relays say they have nothing', () => {
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);
		expect(html()).toContain(say('match.pendingBody'));

		// EOSE, with no matching event. No reason to keep a spinner up once the
		// relays have said they have nothing — it would make the fast, honest
		// answer feel like the slow one.
		relaysSettled.set(true);
		flushSync();

		expect(html()).toContain(say('match.expiredBody'));
		expect(html()).not.toContain(say('match.pendingBody'));
	});

	it('ends after ten seconds even if EOSE never comes', () => {
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);
		expect(html()).toContain(say('match.pendingBody'));

		vi.advanceTimersByTime(MATCH_LINK_BACKSTOP_MS);
		flushSync();

		expect(html()).toContain(say('match.expiredBody'));
	});

	it('is still waiting one tick before the backstop', () => {
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);

		vi.advanceTimersByTime(MATCH_LINK_BACKSTOP_MS - 1);
		flushSync();

		expect(html()).toContain(say('match.pendingBody'));
	});

	it('says the match may have ended some time ago, not merely that it is missing', () => {
		// A link older than the 24-hour window is the common case by far. A
		// recipient who is not told the window closed concludes the site is broken
		// — and blames the sender.
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);
		relaysSettled.set(true);
		flushSync();

		expect(html()).toContain(say('match.expiredBody'));
		expect(html()).toContain(say('cta.deadEndPitch'));
		expect(html()).toContain(say('cta.install'));
	});

	it('strips the link once it has settled on an answer', () => {
		open(`?npub=${NPUB}&match=${MATCH_ID}`);
		relaysSettled.set(true);
		flushSync();

		expect(window.location.search).toBe('');
	});
});

/**
 * Unresolved states what is known so far. It is not terminal, and it does not
 * tear down the subscription that could still answer.
 */
describe('a late arrival', () => {
	it('resolves a link that had already given up', () => {
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);
		vi.advanceTimersByTime(MATCH_LINK_BACKSTOP_MS);
		flushSync();
		expect(html()).toContain(say('match.expiredBody'));

		// A slow relay, or a reconnect.
		matchesMap.set(new Map([[MATCH_ID, match()]]));
		flushSync();

		expect(html()).toContain('Bob');
		expect(html()).not.toContain(say('match.expiredBody'));
	});
});

/**
 * The lookup key is (organizer, matchId), never matchId alone.
 *
 * Four hex characters is 16 bits, generated at random with no collision check.
 * Two organizers CAN publish the same id, and a large tournament reaches the
 * numbers where it becomes likely.
 */
describe('the same match id from a different organizer', () => {
	it('does not resolve the link', () => {
		matchesMap.set(new Map([[MATCH_ID, match({ pubkey: OTHER_HEX, f1_name: 'Stranger' })]]));

		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);

		// Showing it would put one organizer's fight in front of another
		// organizer's guests.
		expect(html()).not.toContain('Stranger');
		expect(html()).toContain(say('match.pendingBody'));
	});

	it('does not expire the link either', () => {
		// An unrelated match that aged out must not declare THIS link dead.
		matchesMap.set(new Map([[MATCH_ID, match({ pubkey: OTHER_HEX })]]));
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);

		expect(html()).toContain(say('match.pendingBody'));
		expect(html()).not.toContain(say('match.expiredBody'));
	});

	it('still resolves once the right organizer’s copy arrives', () => {
		const collision = new Map([[MATCH_ID, match({ pubkey: OTHER_HEX, f1_name: 'Stranger' })]]);
		matchesMap.set(collision);
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);

		matchesMap.set(new Map([[MATCH_ID, match()]]));
		flushSync();

		expect(html()).toContain('Bob');
		expect(html()).not.toContain('Stranger');
	});
});

/**
 * Broken is not Unresolved. Telling a recipient the match ended, when in fact
 * the URL arrived damaged, is a different lie — and the one they will take back
 * to the sender.
 */
describe('a link that names nothing', () => {
	it('says the link is broken when the id fails the grammar', () => {
		const html = open(`?npub=${NPUB}&match=zzzz`);

		expect(html()).toContain(say('match.brokenBody'));
		expect(html()).not.toContain(say('match.expiredBody'));
	});

	it('says the link is broken when there is no organizer to look the match up under', () => {
		// Exactly what a cached bundle leaves behind: it stripped the npub and left
		// the match id, and the viewer refreshed.
		const html = open(`?match=${MATCH_ID}`);

		expect(html()).toContain(say('match.brokenBody'));
		expect(html()).not.toContain(say('match.expiredBody'));
	});

	it('says the link is broken when the npub cannot be decoded', () => {
		const html = open('?npub=npub1badchecksum&match=abcd');

		expect(html()).toContain(say('match.brokenBody'));
		expect(connectToPubkey).not.toHaveBeenCalled();
	});

	it('never waits for a match nobody can ask about', () => {
		const html = open(`?npub=${NPUB}&match=zzzz`);

		expect(html()).not.toContain(say('match.pendingBody'));
		expect(connectToPubkey).not.toHaveBeenCalled();
	});

	it('keeps the install pitch — this is still a dead end', () => {
		const html = open(`?npub=${NPUB}&match=zzzz`);

		expect(html()).toContain(say('cta.deadEndPitch'));
		expect(html()).toContain(say('cta.install'));
	});

	it('clears the damaged link out of the bar rather than leaving it to be forwarded', () => {
		open(`?npub=${NPUB}&match=zzzz`);

		expect(window.location.search).toBe('');
	});
});

describe('the board underneath', () => {
	it('is not substituted for the match, ever', () => {
		// Rule 4: the viewer followed a link meant for one particular thing.
		// Showing them a different thing that looks like it worked is a lie they
		// cannot catch.
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);
		relaysSettled.set(true);
		flushSync();

		expect(html()).not.toContain(say('home.welcomeTitle'));
		expect(html()).toContain(say('match.backToScoreboard'));
	});

	it('is one deliberate tap away', () => {
		const html = open(`?npub=${NPUB}&match=${MATCH_ID}`);
		relaysSettled.set(true);
		flushSync();

		const out = Array.from(target.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === say('match.backToScoreboard')
		);
		expect(out).toBeDefined();

		out?.click();
		flushSync();

		expect(html()).not.toContain(say('match.expiredBody'));
	});

	it('is what a board link still gets, exactly as before', () => {
		// `?npub=` with no `match=` is unchanged: no match view, no broadcast mode.
		const html = open(`?npub=${NPUB}`);

		expect(html()).not.toContain(say('match.pendingBody'));
		expect(html()).toContain(say('pubkey.placeholder'));
	});
});
