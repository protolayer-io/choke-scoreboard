<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Header from '../components/Header.svelte';
	import { locale, t } from '$lib/i18n/index.js';

	let { children } = $props();

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
		<footer class="border-t py-4 text-center text-xs" style="border-color: var(--border-color); color: var(--text-secondary);">
			<p>🥋 {$t('app.name')} — {$t('footer.tagline')} <a href="https://nostr.com" target="_blank" class="underline hover:opacity-80" style="color: var(--color-green-live);">Nostr</a></p>
		</footer>
	</div>
{/if}
