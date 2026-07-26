// @vitest-environment jsdom
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_THEME,
	THEME_CLASS,
	THEME_STORAGE_KEY,
	applyTheme,
	initTheme,
	persistTheme,
	readStoredTheme,
	toggleTheme
} from './theme.js';
import { theme } from './stores.js';
// The shell itself, as text. `?raw` rather than node:fs so the suite needs no
// Node typings — vite.config.ts deliberately keeps them out.
import shell from '../app.html?raw';

/**
 * The theme has to outlive the tab.
 *
 * Not for comfort: this app is opened on a laptop wired to a projector, in a
 * hall someone else chose the lighting of. Making that choice again after every
 * reload — and a scoreboard left running all day gets reloaded — is the kind of
 * small tax that ends with the operator giving up on light mode entirely.
 *
 * Every function takes its storage and its root element, so the branches can be
 * tested without a DOM. In the app, nobody passes them.
 */

/** A localStorage that works, without touching the real one. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
	const data = new Map(Object.entries(seed));
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
		clear: () => data.clear(),
		key: (i: number) => [...data.keys()][i] ?? null,
		get length() {
			return data.size;
		}
	} as Storage;
}

/**
 * A localStorage that throws on every call.
 *
 * Not hypothetical: Safari in private mode, a browser with cookies blocked, and
 * an app embedded in a cross-origin frame all raise here. A board that refused
 * to render because it could not remember a color preference would be a far
 * worse bug than the one this file exists to fix.
 */
function hostileStorage(): Storage {
	const boom = () => {
		throw new DOMException('The operation is insecure.', 'SecurityError');
	};
	return {
		getItem: boom,
		setItem: boom,
		removeItem: boom,
		clear: boom,
		key: boom,
		get length(): number {
			return boom();
		}
	} as unknown as Storage;
}

let root: HTMLElement;

beforeEach(() => {
	root = document.createElement('html');
	theme.set(DEFAULT_THEME);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('readStoredTheme', () => {
	it('returns the saved choice', () => {
		expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'light' }))).toBe('light');
		expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
	});

	it('answers null when nothing was ever saved', () => {
		expect(readStoredTheme(fakeStorage())).toBeNull();
	});

	it('refuses a value that is not a theme', () => {
		// localStorage is shared with every other script on the origin, and with
		// older versions of this app. Anything can be in there.
		expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'LIGHT' }))).toBeNull();
		expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: '{"theme":"light"}' }))).toBeNull();
	});

	it('answers null instead of throwing when storage is blocked', () => {
		expect(readStoredTheme(hostileStorage())).toBeNull();
	});
});

describe('persistTheme', () => {
	it('writes the choice where the next visit will find it', () => {
		// Arrange
		const storage = fakeStorage();

		// Act
		persistTheme('light', storage);

		// Assert
		expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
		expect(readStoredTheme(storage)).toBe('light');
	});

	it('carries on when storage refuses the write', () => {
		expect(() => persistTheme('light', hostileStorage())).not.toThrow();
	});
});

describe('applyTheme', () => {
	it('marks the root for light and unmarks it for dark', () => {
		applyTheme('light', root);
		expect(root.classList.contains(THEME_CLASS)).toBe(true);

		applyTheme('dark', root);
		expect(root.classList.contains(THEME_CLASS)).toBe(false);
	});
});

describe('initTheme', () => {
	it('adopts the saved choice, in the store and on the page', () => {
		// Arrange / Act
		const result = initTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'light' }), root);

		// Assert
		expect(result).toBe('light');
		expect(get(theme)).toBe('light');
		expect(root.classList.contains(THEME_CLASS)).toBe(true);
	});

	it('falls back to dark for a first visit', () => {
		// A scoreboard's resting state is dark: it is the one that survives a dim
		// hall, and it is what every existing install already sees.
		expect(initTheme(fakeStorage(), root)).toBe(DEFAULT_THEME);
		expect(get(theme)).toBe('dark');
		expect(root.classList.contains(THEME_CLASS)).toBe(false);
	});

	it('undoes a light class the shell applied when the saved choice is dark', () => {
		// The inline script in app.html paints the class before this runs. If the
		// choice changed since, init has to clean up after it.
		root.classList.add(THEME_CLASS);

		initTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }), root);

		expect(root.classList.contains(THEME_CLASS)).toBe(false);
	});
});

describe('toggleTheme', () => {
	it('flips, remembers and repaints in one move', () => {
		// Arrange
		const storage = fakeStorage();

		// Act
		const next = toggleTheme(storage, root);

		// Assert
		expect(next).toBe('light');
		expect(get(theme)).toBe('light');
		expect(root.classList.contains(THEME_CLASS)).toBe(true);
		expect(readStoredTheme(storage)).toBe('light');
	});

	it('flips back, and remembers that too', () => {
		// Arrange
		const storage = fakeStorage();
		toggleTheme(storage, root);

		// Act
		const next = toggleTheme(storage, root);

		// Assert
		expect(next).toBe('dark');
		expect(root.classList.contains(THEME_CLASS)).toBe(false);
		expect(readStoredTheme(storage)).toBe('dark');
	});
});

describe('the shell that paints before the bundle boots', () => {
	/**
	 * app.html cannot import this module — it is the static HTML that ships
	 * before any JavaScript of ours exists, and it is the only thing standing
	 * between a light-theme operator and a black flash on every load. So it
	 * repeats the key and the class as literals, and this keeps the copies honest.
	 */
	it('reads the same key this module writes', () => {
		expect(shell).toContain(`'${THEME_STORAGE_KEY}'`);
	});

	it('applies the same class this module applies', () => {
		expect(shell).toContain(`'${THEME_CLASS}'`);
	});

	it('cannot throw the page away when storage is blocked', () => {
		// An uncaught SecurityError there runs before the bundle and takes the
		// whole boot with it, on exactly the browsers least able to report why.
		expect(shell).toMatch(/try\s*\{[\s\S]*catch/);
	});
});
