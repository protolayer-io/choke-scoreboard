<script lang="ts">
	import { theme } from '$lib/stores.js';
	import { t } from '$lib/i18n/index.js';
	import { base } from '$app/paths';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	function toggleTheme(): void {
		theme.update((t) => {
			const next = t === 'dark' ? 'light' : 'dark';
			document.documentElement.classList.toggle('light', next === 'light');
			return next;
		});
	}

	let currentTheme = $state<'dark' | 'light'>('dark');

	$effect(() => {
		const unsub = theme.subscribe((t) => {
			currentTheme = t;
		});
		return unsub;
	});

	// The wordmark is two-tone (design 2A): the first word bright, the rest
	// muted. The brand is never translated, but it still comes through the
	// catalog so there is exactly one place that spells it.
	let brandFirst = $derived($t('app.name').split(' ')[0]);
	let brandRest = $derived($t('app.name').split(' ').slice(1).join(' '));
</script>

<header
	class="sticky top-0 z-50 border-b backdrop-blur-sm"
	style="background: var(--header-bg); border-color: var(--border-color); padding: 18px 30px;"
>
	<div class="mx-auto flex max-w-6xl items-center justify-between">
		<a href="{base}/" class="flex items-center no-underline" style="gap: 14px;">
			<img
				src="{base}/choke.png"
				alt=""
				width="46"
				height="46"
				style="width: 46px; height: 46px; border-radius: 12px; object-fit: cover; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 0 22px rgba(168,85,247,.35);"
			/>
			<span
				style="font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 800; font-size: 27px; line-height: 1; letter-spacing: .02em; color: var(--text-primary);"
			>
				{brandFirst}
				{#if brandRest}
					<span style="color: var(--text-secondary); font-weight: 600;">{brandRest}</span>
				{/if}
			</span>
		</a>

		<div class="flex items-center gap-3">
			<LanguageSwitcher />

			<button
				onclick={toggleTheme}
				class="flex items-center justify-center transition-colors hover:opacity-80"
				style="width: 40px; height: 40px; border-radius: 10px; background: var(--pill-bg); border: 1px solid var(--pill-border); color: var(--icon-muted);"
				aria-label={$t('header.toggleTheme')}
			>
			{#if currentTheme === 'dark'}
				<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
				{/if}
			</button>
		</div>
	</div>
</header>
