import { derived, get, writable } from 'svelte/store';

import { en } from './en.js';
import { es } from './es.js';
import { pt } from './pt.js';

/**
 * The languages the board can speak. English is the source: every other catalog
 * is typed against it, so adding a locale here without a complete catalog is a
 * compile error rather than a blank word on a wall.
 */
export const LOCALES = ['en', 'es', 'pt'] as const;
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
 *
 * This type is the shape. It is NOT the whole guarantee: TypeScript lets a
 * function with fewer parameters stand in for one that takes more, so a catalog
 * merely typed `Catalog` would still accept `home.matchCount: () => 'matches'`
 * or `title.match: (f1) => f1` — the count or the second fighter quietly gone.
 * That last gap is closed by `defineCatalog`, which every locale is built with.
 */
export type Catalog = {
	[K in MessageKey]: Messages[K] extends (...args: infer P) => string
		? (...args: P) => string
		: string;
};

/**
 * The arity guard the type alone cannot give. For every message that is a
 * function, a locale's version is held to the EXACT parameter count of its
 * English original; a key that dropped an argument resolves to a string error
 * type instead of a function type, so the object literal stops compiling on
 * that line — which is the difference between catching `() => 'matches'` here
 * and reading "matches" with no number in front of it off a wall.
 */
type ArityChecked<C extends Catalog> = {
	[K in MessageKey]: Messages[K] extends (...args: infer P) => string
		? C[K] extends (...args: infer Q) => string
			? Q['length'] extends P['length']
				? C[K]
				: `i18n error: '${K & string}' must take ${P['length']} argument(s)`
			: C[K]
		: C[K];
};

/**
 * Build a locale catalog. Prefer this to `const es: Catalog = { … }`: the type
 * annotation alone cannot reject a message that dropped a parameter, and the
 * generic constraint here can. English is the source and defines itself, so it
 * skips this; every translation goes through it.
 */
export function defineCatalog<C extends Catalog & ArityChecked<C>>(catalog: C): Catalog {
	return catalog;
}

const CATALOGS: Record<Locale, Catalog> = { en, es, pt };

const STORAGE_KEY_LOCALE = 'choke:locale';

/**
 * The language on screen.
 *
 * It starts in English and NOT in the reader's language, deliberately: this
 * module also runs where there is no browser (tests, the prerender pass), so the
 * reader is unknown until initLocale() says otherwise.
 */
export const locale = writable<Locale>('en');

export function isLocale(value: unknown): value is Locale {
	return LOCALES.includes(value as Locale);
}

/**
 * The language this reader should get: their choice, then their browser's, then
 * English.
 *
 * Only the language subtag is read, so `es-AR`, `es-419` and `es` all land on
 * Spanish. A board in Buenos Aires is not going to fall back to English because
 * nobody wrote a catalog for its exact region.
 */
export function detectLocale(): Locale {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem(STORAGE_KEY_LOCALE);
		if (isLocale(saved)) return saved;
	}

	if (typeof navigator !== 'undefined') {
		const preferred = navigator.language?.split('-')[0];
		if (isLocale(preferred)) return preferred;
	}

	return 'en';
}

/** Switch language, and remember it — a wall is set up once and left alone. */
export function setLocale(next: Locale): void {
	locale.set(next);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY_LOCALE, next);
	}
}

/** Adopt the reader's language. Call once, from the layout, in the browser. */
export function initLocale(): void {
	locale.set(detectLocale());
}

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
