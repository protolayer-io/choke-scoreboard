<script lang="ts">
	import { theme } from '$lib/stores.js';
	import { t } from '$lib/i18n/index.js';
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
</script>

<header
	class="sticky top-0 z-50 border-b px-4 py-3 backdrop-blur-sm"
	style="background-color: var(--bg-secondary); border-color: var(--border-color);"
>
	<div class="mx-auto flex max-w-6xl items-center justify-between">
		<a href="/" class="flex items-center gap-2 text-xl font-bold no-underline" style="color: var(--text-primary);">
			<span class="text-2xl">🥋</span>
			<span>{$t('app.name')}</span>
		</a>

		<div class="flex items-center gap-2">
			<LanguageSwitcher />

			<button
				onclick={toggleTheme}
				class="rounded-lg p-2 transition-colors hover:opacity-80"
				style="background-color: var(--bg-input); color: var(--text-primary);"
				aria-label={$t('header.toggleTheme')}
			>
			{#if currentTheme === 'dark'}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
				{/if}
			</button>
		</div>
	</div>
</header>
