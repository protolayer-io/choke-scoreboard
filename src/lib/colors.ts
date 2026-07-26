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
