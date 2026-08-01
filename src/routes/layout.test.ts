// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { readable } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';

/**
 * The layout must not remount the page when it swaps chrome.
 *
 * This is not a style rule. The page is what sets `sharedMatchView`, and the
 * layout reads it to decide whether to show header and footer. When
 * `{@render children()}` sat inside both branches of an {#if}, flipping the
 * store moved the page to a different position in the tree — destroying it and
 * mounting a fresh one, whose effect set the store again. Svelte gave up with
 * `effect_update_depth_exceeded`, and every later state change — the match-link
 * backstop, the EOSE signal — landed in a dead effect graph. A shared match
 * link showed "Loading the match…" until the viewer gave up.
 *
 * So: mount once, whatever the chrome does.
 */

vi.mock('$app/stores', () => ({
	page: readable({ route: { id: '/' }, url: new URL('http://x/') })
}));
vi.mock('$lib/fullscreen.js', () => ({
	watchFullscreen: () => () => {},
	isFullscreenSupported: () => false,
	toggleFullscreen: () => {},
	isFullscreen: () => false
}));
vi.mock('$lib/theme.js', () => ({ initTheme: () => {}, watchTheme: () => () => {} }));

const Layout = (await import('./+layout.svelte')).default;
const { sharedMatchView } = await import('$lib/stores.js');

let component: Record<string, unknown> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	sharedMatchView.set(false);
});

it('keeps the page mounted when the shared-match view turns the chrome off', () => {
	// Arrange — a child that does what the real page does: announce itself as a
	// shared match view. Counting setups is counting mounts.
	let setups = 0;
	const children = createRawSnippet(() => {
		setups++;
		return { render: () => '<div data-testid="page">page</div>' };
	});

	component = mount(Layout, {
		target: document.body,
		props: { children }
	}) as Record<string, unknown>;
	flushSync();
	expect(setups).toBe(1);

	// Act — the page resolves a shared match link and the chrome goes away
	sharedMatchView.set(true);
	flushSync();

	// Assert — the same page instance, not a second one
	expect(setups).toBe(1);
	expect(document.querySelectorAll('[data-testid="page"]').length).toBe(1);

	// And back again, because dismissing a link restores the board's chrome
	sharedMatchView.set(false);
	flushSync();
	expect(setups).toBe(1);
});
