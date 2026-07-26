import { describe, expect, it } from 'vitest';

import {
	getBoardPalette,
	getCardPalette,
	glow,
	halfWash,
	tint,
	type BoardStatus,
	type Tintable
} from './board-theme.js';
import { BLACK, contrastRatio, mixOver, parseRgb } from './colors.js';

/**
 * The broadcast board is the only screen in this app that is *watched* rather
 * than used, and it is the only one that was ever drawn twice: design 1A on
 * near-black, design 3A on paper white. This module is where those two drawings
 * are kept side by side, so the board itself renders once.
 *
 * What these tests defend is not the hex digits — it is that the light board
 * never inherits a value only a black background makes sense of. White text and
 * a white winner name are legible in 1A and invisible in 3A.
 */

const ALL_STATUSES: BoardStatus[] = ['waiting', 'in-progress', 'finished', 'canceled', 'paused'];

/** Shared by both suites: the one value neither light surface may ever use. */
const isWhite = (color: string) => ['#fff', '#ffffff', 'white'].includes(color.toLowerCase());

describe('getBoardPalette', () => {
	it('paints the light board on the 3A surface, in 3A ink', () => {
		// Arrange / Act
		const palette = getBoardPalette('light');

		// Assert
		expect(palette.surface).toBe('#f4f6fb');
		expect(palette.ink).toBe('#0d1526');
		expect(palette.muted).toBe('#68758f');
	});

	it('keeps the dark board on the 1A values the app already ships', () => {
		const palette = getBoardPalette('dark');

		expect(palette.surface).toBe('#05070e');
		expect(palette.ink).toBe('#ffffff');
		expect(palette.muted).toBe('#5f6d8a');
	});

	it('dims the losing half with its own surface, never the other theme’s', () => {
		// A near-black veil over a white board reads as a power cut, and a white
		// veil over a black one washes the whole half out.
		expect(getBoardPalette('dark').loserDim).toContain('5,7,14');
		expect(getBoardPalette('light').loserDim).toContain('244,246,251');
	});

	it('gives both boards a status color for every state the board can show', () => {
		const light = getBoardPalette('light');
		const dark = getBoardPalette('dark');

		for (const status of ALL_STATUSES) {
			expect(light.status[status], status).toBeDefined();
			expect(dark.status[status], status).toBeDefined();
		}
	});

	it('never puts white text on the light board', () => {
		// `finished` is the trap: on 1A the FINAL pill is white, and a draw has no
		// winner color to borrow, so the light board must carry its own ink.
		const light = getBoardPalette('light');

		for (const status of ALL_STATUSES) {
			expect(isWhite(light.status[status].color), status).toBe(false);
		}
		for (const role of ['ink', 'muted', 'bannerMuted'] as const) {
			expect(isWhite(light[role]), role).toBe(false);
		}
	});

	it('drops the glows that only exist to bloom against black', () => {
		// The winner's name glows on 1A. On paper, a glow is a smudge.
		expect(getBoardPalette('light').nameGlow).toBe('none');
		expect(getBoardPalette('dark').nameGlow).not.toBe('none');
	});
});

describe('getCardPalette', () => {
	it('gives the card a status color for every state a match can be in', () => {
		const light = getCardPalette('light');
		const dark = getCardPalette('dark');

		for (const status of ALL_STATUSES) {
			expect(light.status[status], status).toBeDefined();
			expect(dark.status[status], status).toBeDefined();
		}
	});

	it('never puts white text on the light card', () => {
		// The card used to be navy under BOTH themes, so its ink was a literal
		// white on purpose. Missing one of these leaves text invisible on paper.
		const light = getCardPalette('light');

		for (const role of ['ink', 'dimName', 'dimScore', 'muted', 'clock', 'vs'] as const) {
			expect(isWhite(light[role]), role).toBe(false);
		}
		for (const status of ALL_STATUSES) {
			expect(isWhite(light.status[status].text), status).toBe(false);
		}
	});

	it('keeps the losing side distinct from the winning side, on both cards', () => {
		// The dim is the card's only way of saying who lost. Letting it collapse
		// into the ink — easy to do on light, where dimmer means *lighter* — would
		// leave a decided match looking like an undecided one.
		for (const theme of ['dark', 'light'] as const) {
			const card = getCardPalette(theme);
			expect(card.dimName, theme).not.toBe(card.ink);
			expect(card.dimScore, theme).not.toBe(card.ink);
		}
	});

	it('keeps every de-emphasised role readable on white', () => {
		// White gives nothing back. `muted` and `vs` are normal-size text (4.5:1);
		// `dimScore` is the losing score at 52px, so it answers to 3:1.
		const light = getCardPalette('light');
		const white = parseRgb(light.surface)!;
		const ratio = (hex: string) => contrastRatio(parseRgb(hex)!, white);

		expect(ratio(light.muted)).toBeGreaterThanOrEqual(4.5);
		expect(ratio(light.clock)).toBeGreaterThanOrEqual(4.5);
		expect(ratio(light.vs)).toBeGreaterThanOrEqual(4.5);
		expect(ratio(light.dimName)).toBeGreaterThanOrEqual(3);
		expect(ratio(light.dimScore)).toBeGreaterThanOrEqual(3);
	});
});

/**
 * What the browser will actually paint for a tinted color, on the background it
 * will actually sit on: the surface with that fighter's own wash over it.
 */
function paintedContrast(
	palette: Tintable,
	color: string
): number {
	const mix = /color-mix\(in srgb, (.+) (\d+)%, black\)/.exec(tint(palette, color));
	const source = parseRgb(mix ? mix[1] : color)!;
	const painted = mixOver(BLACK, source, mix ? 1 - Number(mix[2]) / 100 : 0);
	return contrastRatio(painted, mixOver(source, parseRgb(palette.surface)!, palette.wash.strength));
}

describe('tint', () => {
	/**
	 * The colors an organizer actually reaches for. Every one of these is a legal
	 * belt or team color, and every one of them fails the design's flat 28% black
	 * on white — which is exactly why the amount is measured instead of assumed.
	 */
	const BRIGHT = ['#ffd451', '#ffff00', '#ffffff', '#13c88a', '#ff9f33', '#2563eb'];

	it('darkens a bright fighter color until it can actually be read', () => {
		// Arrange
		const palette = getCardPalette('light');

		// Assert — 3:1 is WCAG's floor for text this large, and a flat 28% left
		// #ffd451 at about 2.7:1 and #ffffff at about 2.0:1.
		for (const color of BRIGHT) {
			expect(paintedContrast(palette, color), color).toBeGreaterThanOrEqual(3);
		}
	});

	it('holds the light board to the same floor', () => {
		const palette = getBoardPalette('light');

		for (const color of BRIGHT) {
			expect(paintedContrast(palette, color), color).toBeGreaterThanOrEqual(3);
		}
	});

	it('never darkens less than the design asked for', () => {
		// The measurement only ever adds to 3A's darken(). A color the mock
		// already handles has to come out looking exactly as it was drawn.
		const painted = tint(getBoardPalette('light'), '#2563eb');
		const percent = Number(/(\d+)%/.exec(painted)![1]);

		expect(percent).toBeLessThanOrEqual(72);
	});

	it('falls back to the design amount for a color it cannot measure', () => {
		// `sanitizeColor` lets through named and oklch colors, which this cannot
		// resolve to channels. Guessing dark would turn a red belt near-black on
		// the strength of nothing.
		expect(tint(getBoardPalette('light'), 'rebeccapurple')).toBe(
			'color-mix(in srgb, rebeccapurple 72%, black)'
		);
	});

	it('leaves a fighter color alone on either dark surface', () => {
		expect(tint(getBoardPalette('dark'), '#ffd451')).toBe('#ffd451');
		expect(tint(getCardPalette('dark'), '#ffd451')).toBe('#ffd451');
	});
});

describe('glow', () => {
	it('composes the geometry with the tinted color', () => {
		const palette = getBoardPalette('dark');

		expect(glow(palette.edgeGlow, '#13c88a')).toBe(
			'0 0 50px color-mix(in srgb, #13c88a 60%, transparent)'
		);
	});

	it('renders a dropped glow as a valid box-shadow, not an empty string', () => {
		// `box-shadow:` with nothing after it is a dropped declaration in some
		// engines and an inherited value in others. `none` is neither.
		expect(glow('none', '#13c88a')).toBe('none');
	});
});

describe('halfWash', () => {
	it('washes the half in the fighter’s color at the theme’s strength', () => {
		expect(halfWash(getBoardPalette('dark').wash, '#13c88a', 100)).toBe(
			'linear-gradient(100deg, color-mix(in srgb, #13c88a 30%, transparent), color-mix(in srgb, #13c88a 5%, transparent) 55%, transparent 78%)'
		);
	});

	it('holds the light wash back, and fades it later', () => {
		// 3A: a lighter tint, carried further before it lets go, so the white
		// center still reads as one board rather than two panels.
		expect(halfWash(getBoardPalette('light').wash, '#13c88a', 260)).toBe(
			'linear-gradient(260deg, color-mix(in srgb, #13c88a 22%, transparent), color-mix(in srgb, #13c88a 5%, transparent) 58%, transparent 80%)'
		);
	});
});
