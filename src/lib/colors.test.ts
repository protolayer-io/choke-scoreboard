import { describe, expect, it } from 'vitest';

import { alpha, darken, sanitizeColor } from './colors.js';

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

describe('sanitizeColor', () => {
	it('falls back when the value carries CSS syntax', () => {
		expect(sanitizeColor('red;background:url(evil)', '#000')).toBe('#000');
	});

	it('keeps a plausible color', () => {
		expect(sanitizeColor('#13c88a', '#000')).toBe('#13c88a');
	});
});
