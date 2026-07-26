/**
 * The theme, and making it outlive the tab.
 *
 * The app is opened on a laptop wired to a projector, in a hall whose lighting
 * somebody else chose. Picking dark or light is a decision about that room, not
 * about that page load — so it is remembered, and it is applied before anything
 * paints (see the inline script in `app.html`).
 *
 * Every function takes the storage and the root element it acts on, so the
 * branches can be tested without a DOM. In the app, nobody passes them — the
 * same shape `fullscreen.ts` uses, for the same reason.
 */

import { theme } from './stores.js';

export type Theme = 'dark' | 'light';

/**
 * What a first visit gets. Dark is the resting state of a scoreboard: it is the
 * one that survives a dim hall, and it is what every existing install sees.
 */
export const DEFAULT_THEME: Theme = 'dark';

/**
 * Where the choice is kept.
 *
 * Repeated as a literal inside `app.html`, which ships before any of our
 * JavaScript exists and so cannot import this. `theme.test.ts` reads that file
 * and asserts the two agree.
 */
export const THEME_STORAGE_KEY = 'choke:theme';

/** The class on <html> that `app.css` hangs the entire light palette off. */
export const THEME_CLASS = 'light';

function isTheme(value: unknown): value is Theme {
	return value === 'dark' || value === 'light';
}

/** The storage to act on: the caller's under test, the browser's in the app. */
function activeStorage(storage?: Storage | null): Storage | null {
	if (storage) return storage;
	return typeof localStorage === 'undefined' ? null : localStorage;
}

/** The element to mark: the caller's under test, <html> in the app. */
function activeRoot(root?: HTMLElement | null): HTMLElement | null {
	if (root) return root;
	return typeof document === 'undefined' ? null : document.documentElement;
}

/**
 * The saved choice, or null if there is none.
 *
 * Reading can throw — Safari in private mode, cookies blocked, a cross-origin
 * frame — and the value itself is untrusted: localStorage is shared with every
 * other script on the origin and with older versions of this app. Anything that
 * is not one of the two themes is treated as nothing saved at all.
 */
export function readStoredTheme(storage?: Storage | null): Theme | null {
	const target = activeStorage(storage);
	if (!target) return null;

	try {
		const stored = target.getItem(THEME_STORAGE_KEY);
		return isTheme(stored) ? stored : null;
	} catch (err) {
		console.warn('Could not read the saved theme:', err);
		return null;
	}
}

/**
 * Remember the choice for the next visit.
 *
 * A refusal is logged and swallowed: the board works fine without a memory, and
 * failing the toggle because storage is blocked would turn a preference into an
 * outage.
 */
export function persistTheme(next: Theme, storage?: Storage | null): void {
	const target = activeStorage(storage);
	if (!target) return;

	try {
		target.setItem(THEME_STORAGE_KEY, next);
	} catch (err) {
		console.warn('Could not save the theme:', err);
	}
}

/**
 * Paint the choice onto the page.
 *
 * The comparison is against the theme, not against THEME_CLASS: those two are
 * the same string today by coincidence, and renaming the class — the one thing
 * `app.css` would survive fine — would otherwise stop this from ever applying it.
 */
export function applyTheme(next: Theme, root?: HTMLElement | null): void {
	activeRoot(root)?.classList.toggle(THEME_CLASS, next === 'light');
}

/**
 * Adopt the saved choice on boot, in the store and on the page.
 *
 * The class is usually already right — `app.html` set it before this bundle
 * existed — but it is written again rather than assumed: the store has to be
 * told regardless, and the two must not be able to disagree.
 */
export function initTheme(storage?: Storage | null, root?: HTMLElement | null): Theme {
	const next = readStoredTheme(storage) ?? DEFAULT_THEME;
	theme.set(next);
	applyTheme(next, root);
	return next;
}

/** Flip the theme, remember it, and repaint. */
export function toggleTheme(storage?: Storage | null, root?: HTMLElement | null): Theme {
	let next: Theme = DEFAULT_THEME;

	theme.update((current) => {
		next = current === 'dark' ? 'light' : 'dark';
		return next;
	});

	applyTheme(next, root);
	persistTheme(next, storage);
	return next;
}
