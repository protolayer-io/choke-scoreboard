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

/**
 * Derive a translucent variant of any CSS color.
 *
 * Uses color-mix() instead of parsing hex by hand, so short hex, named colors
 * and rgb()/hsl() notations all work.
 *
 * @param amount opacity between 0 and 1
 */
export function alpha(color: string, amount: number): string {
	const percent = Math.round(Math.min(Math.max(amount, 0), 1) * 100);
	return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
