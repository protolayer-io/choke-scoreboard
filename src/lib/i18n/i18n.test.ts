import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { en } from './en.js';
import {
	defineCatalog,
	detectLocale,
	LOCALES,
	locale,
	setLocale,
	t,
	translate,
	type MessageKey
} from './index.js';

/**
 * The scoreboard hangs on a wall in a room where nobody is reading English by
 * choice. These tests guard the two ways a translation system fails in public:
 * a message that never got translated, and a message that got translated but
 * lost the number inside it.
 */
describe('the message catalog', () => {
	it('has no empty message', () => {
		// Arrange — an empty string is worse than an untranslated one: it shows a
		// blank spot on the wall, and there is nothing to grep for
		const empty = (Object.keys(en) as MessageKey[]).filter((key) => {
			const message = en[key];
			return typeof message === 'string' && message.trim().length === 0;
		});

		expect(empty).toEqual([]);
	});

	it('ships English and Spanish, and starts in English', () => {
		expect(LOCALES).toContain('en');
		expect(LOCALES).toContain('es');
		expect(get(locale)).toBe('en');
	});
});

describe('translating', () => {
	it('returns the message for a key', () => {
		expect(get(t)('status.live')).toBe('LIVE');
	});

	it('puts the values inside the message, not around it', () => {
		// The whole point of a message function: the translator owns the word
		// order, so a language that says "Bob contra Carlos" can say it
		const title = get(t)('title.match', 'Bob', 'Carlos');

		expect(title).toContain('Bob');
		expect(title).toContain('Carlos');
	});

	it('works outside a component, where a store cannot be subscribed', () => {
		expect(translate()('status.paused')).toBe('PAUSED');
	});
});

/**
 * `1 match` / `2 matches` is not string concatenation. English needs two forms,
 * Spanish two, Polish three, Arabic six — so the count and its noun belong in
 * one message the translator owns, and the rule has to come from
 * Intl.PluralRules instead of a `!== 1 ? 'es' : ''` glued onto a template.
 */
/**
 * A missing key already fails the build; the harder failure is a key that is
 * present but dropped a parameter — `home.matchCount: () => 'matches'` typechecks
 * against a plain function type, and the number is gone. `defineCatalog` is what
 * closes that gap, and these `@ts-expect-error`s fail `svelte-check` if it ever
 * stops closing it. (Vitest strips types, so at runtime these calls just pass.)
 */
describe('defineCatalog enforces parameter arity', () => {
	it('accepts a catalog whose messages keep every parameter', () => {
		const catalog = defineCatalog({ ...en });

		expect(catalog['status.live']).toBe('LIVE');
	});

	it('rejects a message that dropped its count or a fighter', () => {
		// @ts-expect-error — home.matchCount lost its `count`
		defineCatalog({ ...en, 'home.matchCount': () => 'matches' });
		// @ts-expect-error — title.match lost its second fighter
		defineCatalog({ ...en, 'title.match': (f1: string) => f1 });

		expect(true).toBe(true);
	});
});

describe('counting matches', () => {
	it('says one match in the singular', () => {
		expect(get(t)('home.matchCount', 1)).toBe('1 match');
	});

	it('says the plural for everything else', () => {
		expect(get(t)('home.matchCount', 0)).toBe('0 matches');
		expect(get(t)('home.matchCount', 2)).toBe('2 matches');
		expect(get(t)('home.matchCount', 11)).toBe('11 matches');
	});
});

/**
 * Picking the language. Three rules, in order: what the reader chose, what their
 * browser asks for, and English.
 *
 * Neither localStorage nor navigator exists where these tests run — which is the
 * same reason detectLocale() has to guard for both: this module also runs during
 * the prerender pass, where there is no browser to ask.
 */
describe('choosing a language for the reader', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		locale.set('en');
	});

	/** A localStorage that lives in memory, because the test runner has none. */
	function browser(options: { language?: string; saved?: string } = {}): void {
		const store = new Map<string, string>();
		if (options.saved !== undefined) store.set('choke:locale', options.saved);

		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value),
			removeItem: (key: string) => store.delete(key)
		});
		vi.stubGlobal('navigator', { language: options.language ?? 'en-US' });
	}

	it('honours what the reader chose last time, over the browser', () => {
		// Arrange — a Spanish speaker who deliberately set this wall to English
		browser({ language: 'es-AR', saved: 'en' });

		// Assert — their choice wins. A wall is set up once and then left alone.
		expect(detectLocale()).toBe('en');
	});

	it('reads the browser when the reader has never chosen', () => {
		browser({ language: 'es-AR' });

		expect(detectLocale()).toBe('es');
	});

	it('ignores the region, and hears the language', () => {
		// es-AR, es-419 and es are all Spanish. A board in Buenos Aires must not
		// fall back to English because nobody wrote a catalog for its region.
		for (const language of ['es', 'es-AR', 'es-419', 'es-MX']) {
			browser({ language });
			expect(detectLocale()).toBe('es');
		}
	});

	it('hears pt-BR as Portuguese', () => {
		// It used to fall back to English here, which is a special kind of insult
		// in the language the sport is argued in
		browser({ language: 'pt-BR' });

		expect(detectLocale()).toBe('pt');
	});

	it('falls back to English for a language it does not speak', () => {
		browser({ language: 'ja-JP' });

		expect(detectLocale()).toBe('en');
	});

	it('refuses a saved locale that is not a language it speaks', () => {
		// Otherwise the catalog lookup returns undefined and the wall goes blank
		browser({ language: 'en-US', saved: 'klingon' });

		expect(detectLocale()).toBe('en');
	});

	it('remembers the switch', () => {
		browser();

		setLocale('es');

		expect(localStorage.getItem('choke:locale')).toBe('es');
		expect(get(locale)).toBe('es');
	});

	it('survives having no browser at all', () => {
		// The prerender pass: no localStorage, no navigator, and it must not throw
		vi.stubGlobal('localStorage', undefined);
		vi.stubGlobal('navigator', undefined);

		expect(detectLocale()).toBe('en');
	});
});

describe('speaking Spanish', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		locale.set('en');
	});

	it('translates the screen the moment the locale changes', () => {
		// The whole point of the reactive store: not one component was touched
		locale.set('es');

		expect(get(t)('status.live')).toBe('EN VIVO');
		expect(get(t)('status.paused')).toBe('EN PAUSA');
		expect(get(t)('match.notFoundTitle')).toBe('Lucha no encontrada');
	});

	it('counts in Spanish, by Spanish plural rules', () => {
		locale.set('es');

		expect(get(t)('home.matchCount', 1)).toBe('1 lucha');
		expect(get(t)('home.matchCount', 3)).toBe('3 luchas');
		expect(get(t)('home.matchCount', 0)).toBe('0 luchas');
	});

	it('keeps both fighters in the title, in order', () => {
		locale.set('es');

		expect(get(t)('title.match', 'Bob', 'Carlos')).toContain('Bob vs Carlos');
	});
});

describe('speaking Portuguese', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		locale.set('en');
	});

	it('says the submissions the way the sport says them', () => {
		// `armbar` is *chave de braço* here, and the rest of the world learned to
		// say `armbar` from Brazilians who say *chave de braço*. A Brazilian gym
		// reading `Armbar` off the wall would be the tell that nobody thought about
		// who is in the room.
		locale.set('pt');

		expect(get(t)('submission.armbar')).toBe('Chave de braço');
		expect(get(t)('submission.rear_naked_choke')).toBe('Mata-leão');
		expect(get(t)('method.submission')).toBe('FINALIZAÇÃO');
	});

	it('counts in Portuguese', () => {
		locale.set('pt');

		expect(get(t)('home.matchCount', 1)).toBe('1 luta');
		expect(get(t)('home.matchCount', 4)).toBe('4 lutas');
	});

	it('says zero in the plural, whatever CLDR thinks', () => {
		// Intl.PluralRules('pt').select(0) is `one` — CLDR files Portuguese zero
		// under the singular (i = 0..1). No Brazilian gym writes `0 luta`, and this
		// is the DEFAULT screen: an organizer connects, and before a single match
		// arrives the board counts what it has.
		locale.set('pt');

		expect(get(t)('home.matchCount', 0)).toBe('0 lutas');
	});
});
