<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Header from '../components/Header.svelte';
	import { initLocale, locale, t } from '$lib/i18n/index.js';

	let { children } = $props();

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
		</footer>
	</div>
{/if}
