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
	const rule = new Intl.PluralRules(locale).select(count);
	return forms[rule] ?? forms.other;
}
