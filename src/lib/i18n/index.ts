import { derived, get, writable } from 'svelte/store';

import { en } from './en.js';

/**
 * The languages the board can speak. English is the source: every other catalog
 * is typed against it, so adding `es` here without a complete `es.ts` is a
 * compile error rather than a blank word on a wall.
 */
export const LOCALES = ['en'] as const;
export type Locale = (typeof LOCALES)[number];

export type Messages = typeof en;
export type MessageKey = keyof Messages;

/**
 * What another language has to provide: EVERY key, with the SAME parameters.
 *
 * This is the whole reason the catalogs are TypeScript and not JSON. A missing
 * key, a message that forgot its count, a translator who dropped the second
 * fighter out of the title — each stops being something somebody notices in the
 * room, and becomes a red line in the editor.
 *
 * The values widen to `string`. They have to: `typeof en` types 'status.live'
 * as the literal `'LIVE'`, and a catalog held to that could only ever be
 * English again. What is enforced is the SHAPE — every key, and every message
 * that carries values still taking them.
 */
export type Catalog = {
	[K in MessageKey]: Messages[K] extends (...args: infer P) => string
		? (...args: P) => string
		: string;
};

const CATALOGS: Record<Locale, Catalog> = { en };

/** The language on screen. Phase 1 speaks English and nothing else. */
export const locale = writable<Locale>('en');

/** Keys whose message carries values, and so is a function: `title.match(f1, f2)`. */
type ParamKey = {
	[K in MessageKey]: Messages[K] extends (...args: never[]) => string ? K : never;
}[MessageKey];

/** Keys whose message is just a word. */
type PlainKey = Exclude<MessageKey, ParamKey>;

type MessageFn<K extends ParamKey> = Extract<Messages[K], (...args: never[]) => string>;

/**
 * Two call signatures rather than one clever conditional rest parameter, which
 * TypeScript quietly collapses to zero arguments: `$t('home.matchCount', 3)`
 * then stops compiling, and the only way to make it build again is to drop the
 * count — which is how a scoreboard ends up saying "matches" with no number.
 */
export type Translate = {
	(key: PlainKey): string;
	<K extends ParamKey>(key: K, ...args: Parameters<MessageFn<K>>): string;
};

function translator(catalog: Catalog): Translate {
	return ((key: MessageKey, ...args: unknown[]) => {
		const message = catalog[key];
		return typeof message === 'function'
			? (message as (...args: unknown[]) => string)(...args)
			: message;
	}) as Translate;
}

/**
 * Translate, reactively. Components use `$t('status.live')`, so when the locale
 * changes in a later phase every string on screen follows it without a reload —
 * and without a single component having to be touched again.
 */
export const t = derived(locale, ($locale) => translator(CATALOGS[$locale]));

/**
 * Translate outside a component, where there is no `$` to subscribe with.
 *
 * Call it at the moment you need it and do not hold onto the result: it is
 * bound to whatever the locale was when it was called.
 */
export function translate(): Translate {
	return translator(CATALOGS[get(locale)]);
}
