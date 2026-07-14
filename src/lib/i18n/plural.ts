/**
 * Pick the plural form a language actually uses for `count`.
 *
 * English has two forms and Spanish has two, so it is tempting to write
 * `n !== 1 ? 'es' : ''` and move on — which is exactly what this replaces.
 * Polish has three forms and Arabic has six, and none of them are reachable by
 * appending a letter to a noun. `Intl.PluralRules` knows the rule for every
 * locale; a catalog only supplies the forms its own language needs.
 *
 * `other` is required because every language has it. The rest are optional: a
 * catalog that does not need `one` simply leaves it out.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(locale: string, count: number, forms: PluralForms): string {
	// Zero first, and it OVERRIDES the CLDR category instead of being one of them.
	// Portuguese is why: `Intl.PluralRules('pt').select(0)` answers `one`, because
	// CLDR files zero under the singular (i = 0..1). Left to the rules, the board
	// would say `0 luta`, and nobody writes that. `zero` is not a category Intl
	// will ever return for these languages — it is a language's right to say what
	// it actually says when there is nothing to count.
	if (count === 0 && forms.zero !== undefined) return forms.zero;

	const rule = new Intl.PluralRules(locale).select(count);
	return forms[rule] ?? forms.other;
}
