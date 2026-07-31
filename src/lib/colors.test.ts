import { describe, expect, it } from 'vitest';

import {
	BLACK,
	GREEN_LIVE,
	ON_GREEN_DARKEN,
	WHITE,
	alpha,
	contrastRatio,
	darken,
	mixOver,
	parseRgb,
	sanitizeColor,
	type Rgb
} from './colors.js';

/**
 * Fighter colors are chosen by an organizer, not by a designer. They arrive as
 * anything CSS accepts — `#13c88a`, `orange`, `oklch(...)` — which is why every
 * helper here goes through `color-mix()` instead of parsing hex by hand: the
 * moment one of them assumes six hex digits, a match with `gold` belts renders
 * `#NaNNaNNaN` on a wall.
 */
describe('darken', () => {
	it('mixes in black in proportion to the amount', () => {
		// Arrange / Act
		const result = darken('#13c88a', 0.28);

		// Assert — 72% of the color, which is the design's ×0.72 on each channel
		expect(result).toBe('color-mix(in srgb, #13c88a 72%, black)');
	});

	it('leaves the color untouched at zero', () => {
		expect(darken('#13c88a', 0)).toBe('color-mix(in srgb, #13c88a 100%, black)');
	});

	it('accepts named and functional colors, not just hex', () => {
		expect(darken('rebeccapurple', 0.28)).toBe('color-mix(in srgb, rebeccapurple 72%, black)');
		expect(darken('oklch(0.7 0.2 30)', 0.5)).toBe(
			'color-mix(in srgb, oklch(0.7 0.2 30) 50%, black)'
		);
	});

	it('clamps an out-of-range amount instead of emitting invalid CSS', () => {
		// A percentage outside 0–100 makes the whole declaration invalid, and the
		// element loses the color entirely rather than getting a wrong one.
		expect(darken('#fff', 2)).toBe('color-mix(in srgb, #fff 0%, black)');
		expect(darken('#fff', -1)).toBe('color-mix(in srgb, #fff 100%, black)');
	});
});

describe('alpha', () => {
	it('turns an opacity into a color-mix against transparency', () => {
		expect(alpha('#13c88a', 0.6)).toBe('color-mix(in srgb, #13c88a 60%, transparent)');
	});
});

describe('parseRgb', () => {
	it('reads both hex lengths, with or without alpha', () => {
		expect(parseRgb('#13c88a')).toEqual([19, 200, 138]);
		expect(parseRgb('#1c8')).toEqual([17, 204, 136]);
		expect(parseRgb('#13c88aff')).toEqual([19, 200, 138]);
		expect(parseRgb('#1c8f')).toEqual([17, 204, 136]);
	});

	it('reads rgb() in both the legacy and the modern syntax', () => {
		expect(parseRgb('rgb(19, 200, 138)')).toEqual([19, 200, 138]);
		expect(parseRgb('rgb(19 200 138 / 0.5)')).toEqual([19, 200, 138]);
		expect(parseRgb('rgba(19,200,138,0.5)')).toEqual([19, 200, 138]);
	});

	it('says null to a color it cannot resolve without a browser', () => {
		// The point is not that these are invalid — `sanitizeColor` lets them
		// through on purpose, and the browser renders them. It is that guessing
		// their channels is worse than admitting we do not know them.
		expect(parseRgb('rebeccapurple')).toBeNull();
		expect(parseRgb('oklch(0.7 0.2 30)')).toBeNull();
		expect(parseRgb('#12345')).toBeNull();
		expect(parseRgb('rgb(19, 200)')).toBeNull();
	});
});

describe('contrastRatio', () => {
	it('puts black on white at 21:1 and a color against itself at 1:1', () => {
		expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
		expect(contrastRatio([19, 200, 138], [19, 200, 138])).toBeCloseTo(1, 5);
	});

	it('does not care which color is given first', () => {
		const a: Rgb = [19, 200, 138];
		const b: Rgb = [13, 21, 38];
		expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
	});

	it('agrees with the published ratio for a known pair', () => {
		// #767676 on white is the canonical 4.5:1 boundary case.
		expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 1);
	});
});

describe('mixOver', () => {
	it('matches what color-mix paints, at both ends and in between', () => {
		expect(mixOver([0, 0, 0], [200, 100, 50], 0)).toEqual([200, 100, 50]);
		expect(mixOver([0, 0, 0], [200, 100, 50], 1)).toEqual([0, 0, 0]);
		expect(mixOver([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
	});

	it('clamps an out-of-range amount', () => {
		expect(mixOver([0, 0, 0], [200, 100, 50], 2)).toEqual([0, 0, 0]);
		expect(mixOver([0, 0, 0], [200, 100, 50], -1)).toEqual([200, 100, 50]);
	});
});

/**
 * The one green button in the app, measured.
 *
 * The expired-match page ends in a solid green button with white text on it —
 * the only place the brand green is a BACKGROUND for words rather than a chip
 * or a border. At full strength it is a highlighter, and white on it sits
 * around 3.3:1: a bright button that fails anyone reading a phone at arm's
 * length in a gym under a skylight.
 *
 * `ON_GREEN_DARKEN` is what fixes that, and a constant with a comment is not a
 * guarantee — somebody will one day decide the button looks nicer brighter.
 * This is what stops that from shipping.
 */
describe('white on the brand green', () => {
	it('clears WCAG AA once it is taken down by ON_GREEN_DARKEN', () => {
		// Arrange — the same arithmetic the browser does for
		// color-mix(in srgb, var(--color-green-live) 80%, black)
		const button = mixOver(GREEN_LIVE, BLACK, 1 - ON_GREEN_DARKEN);

		// Act
		const ratio = contrastRatio(button, WHITE);

		// Assert — 4.5 is the AA bar for text this size
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it('is the brand green that needed taking down in the first place', () => {
		// If this stops being true the constant has become a superstition: either
		// the palette moved, or somebody is darkening for no reason.
		expect(contrastRatio(GREEN_LIVE, WHITE)).toBeLessThan(4.5);
	});

	it('stays green, and does not quietly become black', () => {
		// The button has to read as the app's own color from across a gym, so this
		// pins the other end: a darken that solved contrast by going nearly black
		// would pass the test above and lose the brand.
		const button = mixOver(GREEN_LIVE, BLACK, 1 - ON_GREEN_DARKEN);

		expect(contrastRatio(button, BLACK)).toBeGreaterThan(2);
	});
});

describe('sanitizeColor', () => {
	it('falls back when the value carries CSS syntax', () => {
		expect(sanitizeColor('red;background:url(evil)', '#000')).toBe('#000');
	});

	it('keeps a plausible color', () => {
		expect(sanitizeColor('#13c88a', '#000')).toBe('#13c88a');
	});
});
