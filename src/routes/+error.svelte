<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { t } from '$lib/i18n/index.js';

	let statusCode = $state(404);

	// The message used to be `page.error.message`, which on a 404 is SvelteKit's
	// own English "Not Found" — a string no catalog in this app can reach. So the
	// page says it itself, in the language the room is reading.
	$effect(() => {
		const unsub = page.subscribe((p) => {
			statusCode = p.status;
		});
		return unsub;
	});

	// This page catches every route error, not only 404s. A 404 is "Page not
	// found"; a 500 or a load that threw is not, and must not say it was.
	let message = $derived(statusCode === 404 ? $t('error.pageNotFound') : $t('error.somethingWrong'));
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
	<span class="text-6xl">🥋</span>
	<h1 class="mt-4 text-4xl font-bold" style="color: var(--text-primary);">{statusCode}</h1>
	<p class="mt-2 text-lg" style="color: var(--text-secondary);">{message}</p>
	<a
		href="{base}/"
		class="mt-6 rounded-lg px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:opacity-90"
		style="background-color: var(--color-green-live, #1BA34E);"
	>
		{$t('error.backToScoreboard')}
	</a>
</div>
