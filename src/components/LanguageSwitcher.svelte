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

<!-- The design-2A pill: the language name and a ▾, nothing else. The native
     select still does the work; it is just dressed as the pill. -->
<label
	class="relative flex cursor-pointer items-center"
	style="gap: 8px; padding: 8px 14px; border-radius: 10px; background: var(--pill-bg); border: 1px solid var(--pill-border);"
>
	<span class="sr-only">{$t('header.selectLanguage')}</span>
	<select
		value={$locale}
		onchange={onChange}
		class="cursor-pointer appearance-none rounded border-0 bg-transparent pr-4 focus-visible:outline-2 focus-visible:outline-offset-2"
		style="font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 600; font-size: 16px; color: var(--icon-muted);"
	>
		{#each LOCALES as code (code)}
			<option value={code} style="color: #111827;">{$t(LANGUAGE_KEYS[code])}</option>
		{/each}
	</select>
	<span
		aria-hidden="true"
		class="pointer-events-none absolute"
		style="right: 12px; color: #6b7890; font-size: 12px;">▾</span
	>
</label>
