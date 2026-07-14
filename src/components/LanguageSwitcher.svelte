<script lang="ts">
	import { LOCALES, locale, setLocale, t, type Locale, type MessageKey } from '$lib/i18n/index.js';

	/**
	 * Every language names itself: 'Español', never 'Spanish'. Somebody hunting
	 * for their own language cannot be asked to read the language the menu happens
	 * to be in — that is the very problem they are trying to solve.
	 *
	 * Constrained to MessageKey, and not to a hand-written union of the keys: that
	 * union had to be edited every time a language was added. `string` would have
	 * been the other way to drop it, and would have accepted a typo like
	 * 'languaje.pt' — a blank word in the menu, which is the one place a reader
	 * cannot recover from. `as const` stays, so each value keeps its literal type
	 * for $t().
	 */
	const LANGUAGE_KEYS = {
		en: 'language.en',
		es: 'language.es',
		pt: 'language.pt'
	} as const satisfies Record<Locale, MessageKey>;

	function onChange(event: Event): void {
		setLocale((event.currentTarget as HTMLSelectElement).value as Locale);
	}
</script>

<label class="flex items-center gap-1.5">
	<span class="sr-only">{$t('header.selectLanguage')}</span>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-4 w-4 shrink-0"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
		style="color: var(--text-secondary);"
	>
		<circle cx="12" cy="12" r="10" />
		<path d="M2 12h20" />
		<path
			d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
		/>
	</svg>
	<select
		value={$locale}
		onchange={onChange}
		class="cursor-pointer rounded-lg border-0 px-1 py-1.5 text-sm font-medium focus:ring-2 focus:outline-none"
		style="background-color: var(--bg-input); color: var(--text-primary); --tw-ring-color: var(--color-green-live);"
	>
		{#each LOCALES as code (code)}
			<option value={code}>{$t(LANGUAGE_KEYS[code])}</option>
		{/each}
	</select>
</label>
