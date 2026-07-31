// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The broadcast board has to FOLLOW the theme, and this is the only thing that
 * says so.
 *
 * `board-theme.test.ts` proves the two palettes are right, the way `tick.test.ts`
 * proves the scheduler is right — and just as blindly: neither can see whether
 * the page uses what it was given. Replacing `getBoardPalette($theme)` with
 * `getBoardPalette('dark')` leaves every other test in this repo green and puts
 * a black wall back in a light-themed app, which is the bug the light theme was
 * built to fix.
 *
 * This is the board's half of that guarantee. It costs two mocks, because a
 * route page reaches for the router.
 */

const MATCH_ID = 'abcd';

vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		page: readable({ params: { id: MATCH_ID }, route: { id: '/match/[id]' } })
	};
});

const BoardPage = (await import('./+page.svelte')).default;
const { getBoardPalette } = await import('$lib/board-theme.js');
const { matchesMap, theme } = await import('$lib/stores.js');
const { BRAND_NAME, PLAY_STORE_URL } = await import('$lib/constants.js');
const { locale, translate } = await import('$lib/i18n/index.js');
type MatchEvent = import('$lib/types.js').MatchEvent;

/**
 * jsdom normalises a hex color in an inline style to `rgb()`, so every
 * expectation has to be stated the way the DOM will hand it back.
 */
function rgb(hex: string): string {
	const n = hex.replace('#', '');
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
	return `rgb(${r}, ${g}, ${b})`;
}

function match(over: Partial<MatchEvent> = {}): MatchEvent {
	const now = Math.floor(Date.now() / 1000);
	return {
		id: MATCH_ID,
		status: 'in-progress',
		// The page hides a match older than MATCH_MAX_AGE_SECONDS, so this is
		// anchored to now rather than to a fixed timestamp.
		start_at: now - 60,
		duration: 300,
		f1_name: 'Bob',
		f2_name: 'Carlos',
		f1_color: '#2563eb',
		f2_color: '#dc2626',
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
		pubkey: 'debug',
		...over
	};
}

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

/**
 * Mount the board and hand back everything it painted.
 *
 * Deliberately not the root element's own `style`, where the surface color is:
 * that attribute also carries the custom properties <Timer> reads, and jsdom
 * drops the whole declaration block when Svelte applies one of those. A real
 * browser does not. So this reads the colors jsdom does keep — they come from
 * the same palette lookup and fail together with it.
 */
function render(over: Partial<MatchEvent> = {}) {
	matchesMap.set(new Map([[MATCH_ID, match(over)]]));
	component = mount(BoardPage, { target, props: {} });
	flushSync();
	return () => target.innerHTML;
}

/**
 * Mount the page for a match that is not there.
 *
 * This is what a shared link turns into: matches age out after a day, and the
 * link outlives them in the chat thread it was pasted into. The store is left
 * empty on purpose — the page cannot tell "expired" from "never existed" from
 * "not loaded yet", and shows the same dead end for all three.
 */
function renderMissing() {
	matchesMap.set(new Map());
	component = mount(BoardPage, { target, props: {} });
	flushSync();
	return () => target.innerHTML;
}

beforeEach(() => {
	target = document.createElement('div');
	document.body.appendChild(target);
	theme.set('dark');
});

afterEach(() => {
	if (component) unmount(component);
	component = null;
	target.remove();
	matchesMap.set(new Map());
	theme.set('dark');
	locale.set('en');
});

describe('the board under each theme', () => {
	it('labels the score breakdown in the dark board’s muted gray', () => {
		// Arrange / Act
		const html = render();

		// Assert
		expect(html()).toContain(rgb(getBoardPalette('dark').muted));
	});

	it('repaints itself when the app switches to light, without remounting', () => {
		// Arrange — mounted dark, as a session starts
		const html = render();
		expect(html()).toContain(rgb(getBoardPalette('dark').status['in-progress'].color));

		// Act — the operator hits the theme toggle on the way in
		theme.set('light');
		flushSync();

		// Assert — the board followed. The dark LIVE green is a highlighter stroke
		// on white, so its absence matters as much as the new color's presence.
		expect(html()).toContain(rgb(getBoardPalette('light').status['in-progress'].color));
		expect(html()).not.toContain(rgb(getBoardPalette('dark').status['in-progress'].color));
		expect(html()).toContain(rgb(getBoardPalette('light').muted));
	});

	it('darkens the winner’s own color before printing it on white', () => {
		// The fighter's color is a bar down the edge AND the winner's name at
		// 86px. Only the second one needs the surface to push back, and that is
		// the difference tint() exists for.
		const html = render({ status: 'finished', winner: 'f1', method: 'submission' });
		expect(html()).toContain(rgb('#2563eb'));

		theme.set('light');
		flushSync();

		// The AMOUNT is deliberately not pinned. How far a color has to be taken
		// down to be readable is tint()'s business and is measured there against
		// real contrast; asserting a percentage here would freeze today's recipe
		// and call a future improvement a regression.
		expect(html()).toMatch(/color-mix\(in srgb, rgb\(37, 99, 235\) \d+%, black\)/);
	});
});

/**
 * The wall is the app's largest audience: a room full of people watching a
 * match, none of whom have heard of it. Every one of those screens has to say
 * where the scores come from and how to get the thing — that is the whole loop,
 * and a board that credits nobody breaks it silently.
 */
describe('the invitation to get the app', () => {
	it('points at the Play Store listing', () => {
		// Arrange / Act
		const html = render();

		// Assert
		expect(html()).toContain(`href="${PLAY_STORE_URL}"`);
	});

	it('opens it in a new tab, without handing the opener over', () => {
		// The board is left running unattended on a projector: a tab that
		// navigated away from a live match would be the operator's problem.
		const html = render();

		expect(html()).toContain('target="_blank"');
		expect(html()).toContain('rel="noopener noreferrer"');
	});

	it('credits the brand in the language of the room', () => {
		const html = render();

		expect(html()).toContain(translate()('cta.scoredWith', BRAND_NAME));
		expect(html()).toContain(BRAND_NAME);
	});

	it('says it in Portuguese when the room reads Portuguese', () => {
		// Arrange — a board already hanging, mid-tournament
		const html = render();
		const english = translate()('cta.scoredWith', BRAND_NAME);

		// Act
		locale.set('pt');
		flushSync();

		// Assert — the sentence changed, the domain did not
		const portuguese = translate()('cta.scoredWith', BRAND_NAME);
		expect(portuguese).not.toBe(english);
		expect(html()).toContain(portuguese);
		expect(html()).not.toContain(english);
		expect(html()).toContain(BRAND_NAME);
	});

	it('gives the link a name a screen reader can read on its own', () => {
		// "bjjscore.live — get the app" out of context is a domain and a shrug;
		// the accessible name has to say where the link goes.
		const html = render();

		expect(html()).toContain(`aria-label="${translate()('cta.getTheApp')}"`);
	});
});

/**
 * The dead end, which is the best moment the app gets.
 *
 * Somebody followed a link a friend shared, to a match that aged out — they
 * came here on purpose, wanting to watch this. Every other page has to earn
 * attention; this one already has it, and until now spent it on a shrug emoji
 * and a link back to a scoreboard belonging to someone else.
 *
 * It is also the ONLY page in the app with no footer to fall back on: this
 * route renders under the broadcast layout, which draws neither header nor
 * footer. Whatever is missing here is missing entirely.
 */
describe('the dead end a shared link becomes', () => {
	it('invites whoever followed the link to get the app', () => {
		// Arrange / Act — a link to a match that is gone
		const html = renderMissing();

		// Assert — the pitch, and somewhere to act on it
		expect(html()).toContain(translate()('cta.deadEndPitch'));
		expect(html()).toContain(`href="${PLAY_STORE_URL}"`);
		expect(html()).toContain(translate()('cta.install'));
	});

	it('still says the match is not there', () => {
		// The invitation is an addition, not a replacement: a person who came for
		// a specific match is owed the reason they are not watching it.
		const html = renderMissing();

		expect(html()).toContain(translate()('match.notFoundTitle'));
		expect(html()).toContain(translate()('match.backToScoreboard'));
	});

	it('speaks the language of whoever followed the link', () => {
		// Arrange — the page as it first painted
		const html = renderMissing();
		const english = translate()('cta.deadEndPitch');

		// Act — the reader's browser asked for Spanish
		locale.set('es');
		flushSync();

		// Assert
		const spanish = translate()('cta.deadEndPitch');
		expect(spanish).not.toBe(english);
		expect(html()).toContain(spanish);
		expect(html()).not.toContain(english);
	});

	it('opens the store in a new tab, without handing the opener over', () => {
		// Asked of the ELEMENT and not of the markup: Svelte is free to order the
		// attributes however it likes, and a test that reads them positionally out
		// of the HTML string fails on a compiler upgrade rather than on a bug.
		renderMissing();
		const store = target.querySelector<HTMLAnchorElement>(`a[href="${PLAY_STORE_URL}"]`);

		expect(store).not.toBeNull();
		expect(store?.target).toBe('_blank');
		expect(store?.rel).toBe('noopener noreferrer');
	});

	it('gives the link a name a screen reader can read on its own', () => {
		const html = renderMissing();

		expect(html()).toContain(`aria-label="${translate()('cta.getTheApp')}"`);
	});
});
