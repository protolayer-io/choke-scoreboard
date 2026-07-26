import { describe, expect, it } from 'vitest';

import {
	getBoardPalette,
	getCardPalette,
	glow,
	halfWash,
	tint,
	type BoardStatus
} from './board-theme.js';

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
		const isWhite = (color: string) => ['#fff', '#ffffff', 'white'].includes(color.toLowerCase());

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
		const isWhite = (color: string) => ['#fff', '#ffffff', 'white'].includes(color.toLowerCase());

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

	it('darkens a fighter’s color for the light card, as the board does', () => {
		// A winning score is printed in the fighter's own color, at 52px.
		expect(tint(getCardPalette('light'), '#ffd451')).toBe('color-mix(in srgb, #ffd451 72%, black)');
		expect(tint(getCardPalette('dark'), '#ffd451')).toBe('#ffd451');
	});
});

describe('tint', () => {
	it('darkens a fighter color before the light board reads it as text', () => {
		// Arrange
		const palette = getBoardPalette('light');

		// Act
		const result = tint(palette, '#ffd451');

		// Assert — the 3A darken(): 72% of the color
		expect(result).toBe('color-mix(in srgb, #ffd451 72%, black)');
	});

	it('leaves a fighter color alone on the dark board', () => {
		expect(tint(getBoardPalette('dark'), '#ffd451')).toBe('#ffd451');
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
