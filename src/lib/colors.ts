/**
 * Color helpers for fighter-tinted UI.
 *
 * Fighter colors arrive from untrusted Nostr events (see parseMatchEvent) and
 * are interpolated into `style` attributes, so they must be sanitized before
 * use: an unchecked value could smuggle extra CSS declarations.
 */

/** Hex notation: #rgb, #rgba, #rrggbb, #rrggbbaa. */
const HEX = /^#[0-9a-f]{3,8}$/i;

/** Named colors, e.g. `blue`, `rebeccapurple`. */
const NAMED = /^[a-z]+$/i;

/** Functional notations, e.g. `rgb(37 99 235)`, `hsl(210, 90%, 55%)`. */
const FUNCTIONAL = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([0-9a-z%.,\s/+-]*\)$/i;

/**
 * Return the color only if it is a plausible CSS color, otherwise the fallback.
 * Values carrying CSS syntax such as `;`, `{}` or `url(...)` are rejected.
 */
export function sanitizeColor(value: string | undefined, fallback: string): string {
	if (!value) return fallback;

	const color = value.trim();
	if (HEX.test(color) || NAMED.test(color) || FUNCTIONAL.test(color)) return color;

	return fallback;
}

/** A 0–1 ratio as the whole-number percentage color-mix() wants. */
function toPercent(amount: number): number {
	return Math.round(Math.min(Math.max(amount, 0), 1) * 100);
}

/**
 * Derive a translucent variant of any CSS color.
 *
 * Uses color-mix() instead of parsing hex by hand, so short hex, named colors
 * and rgb()/hsl() notations all work.
 *
 * @param amount opacity between 0 and 1
 */
export function alpha(color: string, amount: number): string {
	return `color-mix(in srgb, ${color} ${toPercent(amount)}%, transparent)`;
}

/**
 * Derive a darker variant of any CSS color.
 *
 * What this is for: a fighter's color is picked to be seen as a BLOCK — a belt
 * chip, an edge bar — and organizers pick bright ones. Set that same value as
 * TEXT on a white board and a yellow fighter disappears. Mixing black back in
 * keeps the color recognisably theirs while giving it something to stand on.
 *
 * @param amount how much black to mix in, between 0 (unchanged) and 1 (black)
 */
export function darken(color: string, amount: number): string {
	return `color-mix(in srgb, ${color} ${100 - toPercent(amount)}%, black)`;
}

/** sRGB channels, 0–255. */
export type Rgb = [number, number, number];

export const BLACK: Rgb = [0, 0, 0];

export const WHITE: Rgb = [255, 255, 255];

/**
 * The brand green, mirrored here from `--color-green-live` in app.css.
 *
 * Duplicated on purpose: the stylesheet is where the browser reads it, and this
 * is the only place it can be MEASURED. A custom property cannot be resolved in
 * a test, so a green that exists only as a `var()` is a color nobody can prove
 * is readable.
 */
export const GREEN_LIVE: Rgb = [27, 163, 78];

/**
 * How much black the brand green needs behind white text.
 *
 * At full strength it is a highlighter: right as a chip, a border, a dot beside
 * the word LIVE — and about 3.3:1 against white, under the 4.5 body-sized text
 * on a solid button needs. Mixing black in clears the bar while staying the
 * same green from across a room. The number is kept honest by a test in
 * colors.test.ts, not by this comment.
 */
export const ON_GREEN_DARKEN = 0.2;

/**
 * The channels of a color, or null when this notation cannot be measured here.
 *
 * Deliberately narrow. `sanitizeColor` accepts anything CSS plausibly accepts —
 * named colors, `oklch()`, `color()` — because the browser is what renders it,
 * and it knows them all. Measuring is a different job: resolving `rebeccapurple`
 * or an oklch triple to sRGB by hand is a color-management library, and a wrong
 * answer is worse than no answer here, because callers act on it. So this reads
 * the two notations an organizer's app actually sends, and says null to the rest.
 */
export function parseRgb(color: string): Rgb | null {
	const value = color.trim().toLowerCase();

	const hex = /^#([0-9a-f]{3,8})$/.exec(value);
	if (hex) {
		const digits = hex[1];
		// #rgb and #rgba: each digit is a doubled channel. #rrggbb and #rrggbbaa:
		// pairs. Any other length is not a color. Alpha is ignored either way —
		// these colors are painted opaque.
		if (digits.length === 3 || digits.length === 4) {
			return [0, 1, 2].map((i) => parseInt(digits[i] + digits[i], 16)) as Rgb;
		}
		if (digits.length === 6 || digits.length === 8) {
			return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as Rgb;
		}
		return null;
	}

	const functional = /^rgba?\(([^)]*)\)$/.exec(value);
	if (functional) {
		const parts = functional[1]
			.split(/[\s,/]+/)
			.filter(Boolean)
			.slice(0, 3);
		if (parts.length < 3) return null;

		const channels = parts.map((part) =>
			part.endsWith('%') ? (parseFloat(part) * 255) / 100 : parseFloat(part)
		);
		if (channels.some((channel) => !Number.isFinite(channel))) return null;

		return channels.map((channel) => Math.min(Math.max(channel, 0), 255)) as Rgb;
	}

	return null;
}

/** WCAG relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
	const [rl, gl, bl] = [r, g, b].map((channel) => {
		const srgb = Math.min(Math.max(channel, 0), 255) / 255;
		return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG contrast between two colors: 1 when identical, 21 for black on white. */
export function contrastRatio(a: Rgb, b: Rgb): number {
	const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
	const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * `top` laid over `bottom` at `amount` opacity — the same arithmetic
 * `color-mix(in srgb, …)` does, so a measurement here predicts what the browser
 * will actually paint.
 */
export function mixOver(top: Rgb, bottom: Rgb, amount: number): Rgb {
	const ratio = Math.min(Math.max(amount, 0), 1);
	return [0, 1, 2].map((i) => bottom[i] + (top[i] - bottom[i]) * ratio) as Rgb;
}
