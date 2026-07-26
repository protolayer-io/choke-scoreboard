/**
 * A props object a test can reassign after the component is already mounted.
 *
 * `mount()` reads plain props once, so assigning to them later changes nothing and
 * a test written that way silently proves only what happens at mount. Passing a
 * `$state` proxy instead is what makes a prop update reach the component — which
 * is the whole path a relay event travels: the match object is replaced, and the
 * countdown has to react to it.
 *
 * This lives in a `.svelte.ts` file because that is the only kind of TypeScript
 * module where runes compile. It exists for tests; nothing in the app needs it,
 * because in the app Svelte wires the props itself.
 */
export function reactiveProps<T extends object>(initial: T): T {
	const props = $state(initial);
	return props;
}
