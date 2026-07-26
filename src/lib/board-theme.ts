/**
 * The palettes of the two surfaces that show a score: the full-viewport
 * broadcast board, and the match card on the list.
 *
 * The board was drawn twice: design 1A on near-black, design 3A on paper white.
 * They are the same board — same layout, same animations, same fighter colors —
 * so the component renders once and reads its colors from here. The card follows
 * it, for the reason written above `CARD_LIGHT`.
 *
 * Why a module and not CSS variables: half of what separates the two drawings is
 * not a color but a RECIPE applied to a color nobody knew at build time. The
 * fighter's own hex arrives from a Nostr event and has to be washed across a
 * half, bloomed under an edge bar, and — on white — darkened before it can be
 * read as text. That is arithmetic, and it belongs somewhere it can be tested.
 */

import { alpha, darken } from './colors.js';
import type { MatchStatus } from './types.js';

export type BoardTheme = 'dark' | 'light';

/**
 * Every state the status pill can show. A paused match is still `in-progress`
 * on the wire, so it has no status of its own — but it does have a color.
 */
export type BoardStatus = MatchStatus | 'paused';

/** A glow, as its CSS geometry plus how much of the tint to bloom. */
export type GlowSpec = { geometry: string; opacity: number } | 'none';

/**
 * The diagonal wash of a fighter's color across their half: how strong it starts
 * at the outer edge, what it has faded to by `fade`, and where it lets go.
 */
export interface WashSpec {
	strength: number;
	mid: number;
	fade: string;
	end: string;
}

/** Anything that knows how far to darken a fighter's color. See `tint()`. */
interface Tintable {
	tintAmount: number;
}

/** The ADV and PEN chips: a tinted box with a label and a count. */
export interface BoardChip {
	bg: string;
	border: string;
	label: string;
	value: string;
}

export interface BoardPalette {
	/** The board itself, behind both halves. */
	surface: string;
	/** Names, scores, breakdown counts — the loudest text on the board. */
	ink: string;
	/** The small caps above them: 2 PTS, TIME. */
	muted: string;
	/**
	 * WINNER and the method detail. A step brighter than `muted` on dark, where
	 * the banner is a veil laid over a lit half rather than a surface of its own.
	 */
	bannerMuted: string;
	/** The sheet dropped over the losing half once a winner is known. */
	loserDim: string;
	/** The VS between the two halves, barely there by design. */
	vs: string;
	/** Tailwind classes for the overlay controls, hover states included. */
	chrome: string;
	/** The diagonal wash behind a half. */
	wash: WashSpec;
	/** Under the edge bar running down the outside of a half. */
	edgeGlow: GlowSpec;
	/** Under the color chip beside a fighter's name. */
	chipGlow: GlowSpec;
	/** Behind the big score. */
	scoreGlow: GlowSpec;
	/** Behind the winner's name on the final banner. */
	nameGlow: GlowSpec;
	/** Around the live dot in the status pill. */
	dotGlow: GlowSpec;
	/** The card the clock sits on. */
	card: { bg: string; border: string; shadow: string };
	/**
	 * The winner banner. `lineOpacity` is how much of the winner's color its
	 * hairline border takes — zero on dark, where the banner is a veil with no
	 * edge, but the border is always drawn so neither theme shifts by a pixel.
	 */
	banner: { bg: string; shadow: string; frosted: boolean; lineOpacity: number };
	advantage: BoardChip;
	penalty: BoardChip;
	status: Record<BoardStatus, { color: string; dot: string }>;
	/**
	 * How much black to mix into a fighter's color before setting it as text.
	 * Zero on dark: the color was chosen against black and needs no help there.
	 */
	tintAmount: number;
	/** The clock in its last seconds, and the clock at zero. */
	warn: string;
	danger: string;
}

/** Design 1A — the board on near-black. */
const DARK: BoardPalette = {
	surface: '#05070e',
	ink: '#ffffff',
	muted: '#5f6d8a',
	bannerMuted: '#8a97b2',
	loserDim: 'rgba(5,7,14,.62)',
	vs: 'rgba(255,255,255,.16)',
	chrome: 'text-white/60 hover:bg-white/10 hover:text-white',
	wash: { strength: 0.3, mid: 0.05, fade: '55%', end: '78%' },
	edgeGlow: { geometry: '0 0 50px', opacity: 0.6 },
	chipGlow: { geometry: '0 0 20px', opacity: 0.6 },
	scoreGlow: { geometry: '0 0 55px', opacity: 0.6 },
	nameGlow: { geometry: '0 0 46px', opacity: 0.6 },
	dotGlow: { geometry: '0 0 14px', opacity: 1 },
	card: {
		bg: 'rgba(255,255,255,.03)',
		border: 'rgba(255,255,255,.09)',
		shadow: '0 0 60px rgba(0,0,0,.45)'
	},
	banner: { bg: 'rgba(5,7,14,.72)', shadow: 'none', frosted: true, lineOpacity: 0 },
	advantage: {
		bg: 'rgba(244,180,0,.14)',
		border: 'rgba(244,180,0,.45)',
		label: '#f4b400',
		value: '#ffd451'
	},
	penalty: {
		bg: 'rgba(239,68,68,.14)',
		border: 'rgba(239,68,68,.5)',
		label: '#f87171',
		value: '#fca5a5'
	},
	status: {
		waiting: { color: '#8a97b2', dot: '#8a97b2' },
		'in-progress': { color: '#2ee08a', dot: '#16c05f' },
		finished: { color: '#ffffff', dot: '#ffffff' },
		canceled: { color: '#f87171', dot: '#ef4444' },
		paused: { color: '#f5b800', dot: '#f5b800' }
	},
	tintAmount: 0,
	warn: '#f5b800',
	danger: '#c0392b'
};

/**
 * Design 3A — the same board on paper white.
 *
 * Every value here answers a value above. The two the mock never draws are
 * `waiting` and `canceled`: they take the darkest members of the families 3A
 * does use, so a paused clock reads in the same amber as the ADV chip beside it
 * and a canceled match in the same red as PEN.
 */
const LIGHT: BoardPalette = {
	surface: '#f4f6fb',
	ink: '#0d1526',
	muted: '#68758f',
	bannerMuted: '#68758f',
	loserDim: 'rgba(244,246,251,.72)',
	vs: 'rgba(13,21,38,.16)',
	chrome: 'text-[#68758f] hover:bg-black/5 hover:text-[#0d1526]',
	wash: { strength: 0.22, mid: 0.05, fade: '58%', end: '80%' },
	edgeGlow: { geometry: '0 0 44px', opacity: 0.32 },
	// Light drops the glow that surrounds and lifts the one that falls: on paper,
	// a shape is grounded by its shadow, not by a halo.
	chipGlow: { geometry: '0 4px 16px', opacity: 0.32 },
	scoreGlow: { geometry: '0 6px 30px', opacity: 0.3 },
	nameGlow: 'none',
	dotGlow: 'none',
	card: {
		bg: '#ffffff',
		border: 'rgba(13,21,38,.1)',
		shadow: '0 18px 46px rgba(13,21,38,.14)'
	},
	banner: {
		bg: '#ffffff',
		shadow: '0 26px 70px rgba(13,21,38,.2)',
		frosted: false,
		lineOpacity: 0.45
	},
	advantage: {
		bg: 'rgba(202,138,4,.12)',
		border: 'rgba(202,138,4,.42)',
		label: '#a16207',
		value: '#854d0e'
	},
	penalty: {
		bg: 'rgba(220,38,38,.1)',
		border: 'rgba(220,38,38,.42)',
		label: '#dc2626',
		value: '#991b1b'
	},
	status: {
		waiting: { color: '#5b6780', dot: '#8a97b2' },
		'in-progress': { color: '#0f9d58', dot: '#16c05f' },
		// Only ever seen on a draw — any other final borrows the winner's color.
		finished: { color: '#0d1526', dot: '#0d1526' },
		canceled: { color: '#b91c1c', dot: '#dc2626' },
		paused: { color: '#a16207', dot: '#ca8a04' }
	},
	// 3A's darken(): 72% of each channel.
	tintAmount: 0.28,
	warn: '#a16207',
	danger: '#991b1b'
};

/** A tinted box on the card: status pill, ADV, PEN. */
export interface CardChip {
	bg: string;
	border: string;
	text: string;
}

/**
 * The match card on the list — design 2A. Smaller than the board and drawn in
 * its own proportions, but the same idea: two fighters, their colors, a score.
 */
export interface CardPalette {
	surface: string;
	border: string;
	shadow: string;
	/** Names and scores of whoever is still in it. */
	ink: string;
	/** The loser, once there is one: sunk toward the background, not deleted. */
	dimName: string;
	dimScore: string;
	/** The point breakdown's labels in broadcast mode. */
	muted: string;
	/** The clock in the corner. Small type, so it gets more contrast than `muted`. */
	clock: string;
	vs: string;
	wash: WashSpec;
	advantage: CardChip;
	penalty: CardChip;
	status: Record<BoardStatus, CardChip & { dot: string }>;
	/** The strip under a live card. */
	liveBar: { border: string; bg: string; dot: string; text: string };
	/** The running clock between the two fighters. */
	liveClock: CardChip;
	/** The strip under a finished card, saying how it ended. */
	outcome: { border: string; bg: string; method: string; detail: string };
	tintAmount: number;
	warn: string;
	danger: string;
}

/** Design 2A — the card on navy. */
const CARD_DARK: CardPalette = {
	surface: '#0b1120',
	border: 'rgba(255,255,255,.07)',
	shadow: '0 10px 28px rgba(0,0,0,.35)',
	ink: '#ffffff',
	dimName: '#66738f',
	dimScore: '#414d68',
	muted: '#5f6d8a',
	clock: '#4a5878',
	vs: '#556489',
	wash: { strength: 0.16, mid: 0.02, fade: '60%', end: '82%' },
	advantage: { bg: 'rgba(244,180,0,.16)', border: 'rgba(244,180,0,.45)', text: '#f4c453' },
	penalty: { bg: 'rgba(239,68,68,.16)', border: 'rgba(239,68,68,.5)', text: '#fca5a5' },
	status: {
		'in-progress': {
			bg: 'rgba(22,192,95,.14)',
			border: 'rgba(22,192,95,.5)',
			text: '#2ee08a',
			dot: '#16c05f'
		},
		waiting: {
			bg: 'rgba(244,180,0,.12)',
			border: 'rgba(244,180,0,.4)',
			text: '#f4c453',
			dot: '#f4b400'
		},
		finished: {
			bg: 'rgba(255,255,255,.05)',
			border: 'rgba(255,255,255,.12)',
			text: '#a7b2ce',
			dot: '#5f6d8a'
		},
		canceled: {
			bg: 'rgba(239,68,68,.14)',
			border: 'rgba(239,68,68,.5)',
			text: '#fca5a5',
			dot: '#ef4444'
		},
		paused: {
			bg: 'rgba(245,184,0,.12)',
			border: 'rgba(245,184,0,.4)',
			text: '#f5b800',
			dot: '#f5b800'
		}
	},
	liveBar: {
		border: 'rgba(22,192,95,.18)',
		bg: 'rgba(22,192,95,.05)',
		dot: '#2ee08a',
		text: '#3ee08a'
	},
	liveClock: { bg: 'rgba(22,192,95,.12)', border: 'rgba(22,192,95,.4)', text: '#3ee08a' },
	outcome: {
		border: 'rgba(255,255,255,.07)',
		bg: 'rgba(255,255,255,.015)',
		method: '#f4c453',
		detail: '#8391b0'
	},
	tintAmount: 0,
	warn: '#f5b800',
	danger: '#c0392b'
};

/**
 * The card on paper white.
 *
 * There is no mock for this one. The card used to be navy in BOTH themes, on the
 * argument that it is a scoreboard and scoreboards are dark — but that argument
 * died with design 3A, which is a scoreboard on white. A dark card on a light
 * list is now the only thing in the app that does not follow the theme.
 *
 * So it is derived rather than drawn: surface and ink from 3A, and the chips from
 * the light values `app.css` already gives the status filter, which sits directly
 * above these cards and would otherwise disagree with them about what LIVE
 * looks like.
 */
const CARD_LIGHT: CardPalette = {
	surface: '#ffffff',
	border: 'rgba(13,21,38,.1)',
	shadow: '0 10px 28px rgba(13,21,38,.1)',
	ink: '#0d1526',
	// The loser's name has to read as sunk WITHOUT becoming unreadable: it is
	// still one of the two names on the card. This lands near 3.5:1 on white,
	// which is about where #66738f sits against the navy card.
	dimName: '#7c879c',
	dimScore: '#b6bdcc',
	muted: '#68758f',
	clock: '#5b6780',
	vs: '#8a94ab',
	wash: { strength: 0.14, mid: 0.02, fade: '60%', end: '82%' },
	advantage: { bg: 'rgba(202,138,4,.12)', border: 'rgba(202,138,4,.42)', text: '#854d0e' },
	penalty: { bg: 'rgba(220,38,38,.1)', border: 'rgba(220,38,38,.42)', text: '#991b1b' },
	status: {
		'in-progress': {
			bg: 'rgba(22,192,95,.12)',
			border: 'rgba(4,120,87,.45)',
			text: '#047857',
			dot: '#16c05f'
		},
		waiting: {
			bg: 'rgba(244,180,0,.15)',
			border: 'rgba(146,64,14,.4)',
			text: '#92400e',
			dot: '#ca8a04'
		},
		finished: {
			bg: 'rgba(0,0,0,.05)',
			border: 'rgba(0,0,0,.2)',
			text: '#374151',
			dot: '#6b7280'
		},
		canceled: {
			bg: 'rgba(239,68,68,.1)',
			border: 'rgba(185,28,28,.4)',
			text: '#b91c1c',
			dot: '#dc2626'
		},
		paused: {
			bg: 'rgba(245,184,0,.12)',
			border: 'rgba(146,64,14,.4)',
			text: '#a16207',
			dot: '#ca8a04'
		}
	},
	liveBar: {
		border: 'rgba(4,120,87,.2)',
		bg: 'rgba(22,192,95,.07)',
		dot: '#16c05f',
		text: '#047857'
	},
	liveClock: { bg: 'rgba(22,192,95,.1)', border: 'rgba(4,120,87,.35)', text: '#047857' },
	outcome: {
		border: 'rgba(13,21,38,.1)',
		bg: 'rgba(13,21,38,.02)',
		method: '#a16207',
		detail: '#5b6780'
	},
	tintAmount: 0.28,
	warn: '#a16207',
	danger: '#991b1b'
};

/** The palette the board paints itself with under the app's current theme. */
export function getBoardPalette(theme: BoardTheme): BoardPalette {
	return theme === 'light' ? LIGHT : DARK;
}

/** The palette the match card paints itself with under the app's current theme. */
export function getCardPalette(theme: BoardTheme): CardPalette {
	return theme === 'light' ? CARD_LIGHT : CARD_DARK;
}

/**
 * A glow as a complete shadow value.
 *
 * Returns the keyword `none` rather than an empty string when the theme has no
 * glow here: `box-shadow:` with nothing after it is a dropped declaration, and a
 * dropped declaration leaves whatever was there before it.
 */
export function glow(spec: GlowSpec, color: string): string {
	if (spec === 'none') return 'none';
	return `${spec.geometry} ${alpha(color, spec.opacity)}`;
}

/**
 * The diagonal wash behind one half, fading out toward the center.
 *
 * Takes the spec and not the palette, because the board and the card wash their
 * halves in the same way at different strengths.
 */
export function halfWash(wash: WashSpec, color: string, angle: number): string {
	return `linear-gradient(${angle}deg, ${alpha(color, wash.strength)}, ${alpha(color, wash.mid)} ${wash.fade}, transparent ${wash.end})`;
}

/** A fighter's color, made safe to read as text on this surface. */
export function tint(palette: Tintable, color: string): string {
	return palette.tintAmount === 0 ? color : darken(color, palette.tintAmount);
}
