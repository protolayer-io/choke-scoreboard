<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Header from '../components/Header.svelte';
	import { initLocale, locale, t } from '$lib/i18n/index.js';
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
	let isBroadcast = $derived($page.route.id === '/match/[id]');

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

{#if isBroadcast}
	<div class="h-dvh w-screen overflow-hidden">
		{@render children()}
	</div>
{:else}
	<div class="flex min-h-screen flex-col">
		<Header />
		<main class="flex-1">
			{@render children()}
		</main>
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
	</div>
{/if}
