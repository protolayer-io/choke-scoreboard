<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Header from '../components/Header.svelte';
	import { initLocale, locale, t } from '$lib/i18n/index.js';
	import { sharedMatchView } from '$lib/stores.js';
	import { watchFullscreen } from '$lib/fullscreen.js';
	import { initTheme, watchTheme } from '$lib/theme.js';
	import { BRAND_NAME, PLAY_STORE_URL } from '$lib/constants.js';

	let { children } = $props();

	// Adopt the theme the operator last chose, HERE and not in an $effect.
	//
	// `app.html` has already put the class on <html>, before the first paint —
	// but the class is only half of it: the board and the cards read their
	// palettes from the `theme` store, which would otherwise still say dark while
	// the page around them says light. Running at setup, before this layout's
	// children exist, is what makes the store true for the very first render
	// rather than true a moment later.
	initTheme();

	// Fullscreen is a property of the window, not of a route: watch it once, here,
	// so the toggle's label stays right when the user leaves fullscreen with Esc
	// or F11 — and survives navigating from the list into a match and back.
	$effect(() => watchFullscreen());

	// Follow the theme when it is chosen in another tab. The operator's setup is
	// two of them — the board on the projector, the list on the laptop they are
	// touching — and only the tab that was clicked repaints itself.
	$effect(() => watchTheme());

	// Adopt the reader's language: what they chose last time, or what their
	// browser asks for. The store starts in English because this code also runs
	// where there is no browser to ask — until here, in the browser, there is.
	$effect(() => {
		initLocale();
	});


	// The broadcast match view owns the whole viewport: no header, no footer.
	//
	// Two ways to be in it, because a shared match link is NOT a route: the app's
	// App Links filter claims `/` and nothing deeper, so `?npub=…&match=…`
	// resolves on the root page and the router has nothing to tell us apart by.
	let isBroadcast = $derived($page.route.id === '/match/[id]' || $sharedMatchView);

	// Keep <html lang> and the description honest.
	//
	// Both ship from app.html with an English value, because the app renders
	// client-side and that shell is all a crawler ever sees. Left alone, they
	// would go on claiming English at a board reading Spanish: a screen reader
	// would pronounce it as English, and the browser would offer to translate a
	// page already in the reader's language.
	//
	// They are REWRITTEN here rather than emitted from <svelte:head>, which would
	// add a second <meta name="description"> on the client and leave the static
	// HTML with none.
	$effect(() => {
		document.documentElement.lang = $locale;
		document
			.querySelector('meta[name="description"]')
			?.setAttribute('content', $t('app.description'));
	});
</script>

<!--
	`children()` is rendered from exactly ONE place, and the chrome comes and goes
	around it. Load-bearing, not tidiness.

	Two call sites — one per branch of an {#if} — are two different positions in
	the tree, so flipping `isBroadcast` DESTROYS the page and mounts a fresh one.
	That is fatal here, because the page is what sets `sharedMatchView`, which is
	what `isBroadcast` reads: unmounting runs the page's cleanup (set false),
	mounting runs its effect again (set true), and the layout swaps branches
	again — an effect that reads and writes the same state, through two
	components. Svelte aborts the graph with `effect_update_depth_exceeded`, and
	from that moment nothing reactive updates at all: a shared match link sat on
	"Loading the match…" forever, because the backstop and the EOSE signal both
	fired into a dead effect graph.

	One call site makes the flip an attribute change on elements that stay put,
	and the page is mounted once.
-->
<div class={isBroadcast ? 'h-dvh w-screen overflow-hidden' : 'flex min-h-screen flex-col'}>
	{#if !isBroadcast}
		<Header />
	{/if}

	<!-- `contents` so the broadcast view goes on laying out against the viewport,
	     exactly as it did when there was no wrapper in its branch at all. -->
	<main class={isBroadcast ? 'contents' : 'flex-1'}>
		{@render children()}
	</main>

	{#if !isBroadcast}
		<footer
			class="border-t text-center"
			style="border-color: var(--border-color); padding: 20px 0 24px; font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 500; font-size: 16px; color: #6b7890;"
		>
			<p>
				{$t('app.name')} — {$t('footer.builtBy')}
				<a
					href="https://protolayer.io"
					target="_blank"
					rel="noopener noreferrer"
					class="no-underline hover:opacity-80"
					style="color: var(--link-color);">ProtoLayer.io</a
				>
			</p>
			<!--
				The same invitation the broadcast wall carries. Every page a stranger can
				land on — a shared match link, the list left open on somebody's laptop — has
				to say where the scores come from and how to get the app.
			-->
			<p class="mt-1">
				<a
					href={PLAY_STORE_URL}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={$t('cta.getTheApp')}
					class="no-underline hover:opacity-80"
					style="color: var(--link-color);">{$t('cta.scoredWith', BRAND_NAME)}</a
				>
			</p>
		</footer>
	{/if}
</div>
