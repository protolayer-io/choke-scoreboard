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

		theme.set('light');
		flushSync();

		expect(html()).toContain('color-mix(in srgb, rgb(37, 99, 235) 72%, black)');
	});
});
