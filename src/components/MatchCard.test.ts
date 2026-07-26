// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import MatchCard from './MatchCard.svelte';
import { getCardPalette } from '../lib/board-theme.js';
import { theme } from '../lib/stores.js';
import type { MatchEvent } from '../lib/types.js';

/**
 * The card has to FOLLOW the theme, and this is the only thing that says so.
 *
 * `board-theme.test.ts` proves the two palettes are right, the way `tick.test.ts`
 * proves the scheduler is right — and just as blindly: neither can see whether
 * the component uses what it was given. Replacing `getCardPalette($theme)` with
 * `getCardPalette('dark')` leaves every other test in this repo green and
 * restores, exactly, the bug this was reported for: a navy card on a white list.
 *
 * So this mounts the real component and reads the colors it actually painted.
 */

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
	return {
		id: 'abcd',
		status: 'in-progress',
		start_at: 1_700_000_000,
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
		created_at: 1_700_000_000,
		pubkey: 'debug',
		...over
	};
}

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

/**
 * Mount the card and hand back everything it painted.
 *
 * Deliberately not the root <a>'s own `style`, which is where the surface color
 * lives: that attribute also carries the two custom properties <Timer> reads,
 * and jsdom drops the whole declaration block when Svelte applies one of those.
 * A real browser does not — the surface was checked there, over CDP — so this
 * reads the colors jsdom does keep, which come from the same palette lookup and
 * fail together with it.
 */
function render(over: Partial<MatchEvent> = {}) {
	component = mount(MatchCard, { target, props: { match: match(over), mode: 'compact' } });
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
	theme.set('dark');
});

describe('the card under each theme', () => {
	it('paints a live card in the dark theme’s green', () => {
		// Arrange / Act
		const html = render();

		// Assert
		expect(html()).toContain(rgb(getCardPalette('dark').status['in-progress'].text));
	});

	it('repaints itself when the app switches to light, without remounting', () => {
		// Arrange — mounted dark, as a session starts
		const html = render();
		expect(html()).toContain(rgb(getCardPalette('dark').status['in-progress'].text));

		// Act — the operator hits the theme toggle
		theme.set('light');
		flushSync();

		// Assert — the card followed. The dark green is a highlighter stroke on
		// white, so its absence matters as much as the new color's presence.
		expect(html()).toContain(rgb(getCardPalette('light').status['in-progress'].text));
		expect(html()).not.toContain(rgb(getCardPalette('dark').status['in-progress'].text));
	});

	it('dims the loser in the direction its own theme sinks', () => {
		// The one value that inverts between themes: on navy the loser goes
		// darker, on paper it goes lighter. A literal here would have printed the
		// loser in the winner's weight on one of the two cards.
		const html = render({ status: 'finished', winner: 'f1', method: 'points' });
		expect(html()).toContain(rgb(getCardPalette('dark').dimName));

		theme.set('light');
		flushSync();

		expect(html()).toContain(rgb(getCardPalette('light').dimName));
	});
});
