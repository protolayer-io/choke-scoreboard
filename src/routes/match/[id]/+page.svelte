<script lang="ts">
	import { page } from '$app/stores';
	import { activePubkey, findMatchByOrganizer, matchesMap } from '$lib/stores.js';
	import { MATCH_AGE_CHECK_INTERVAL_MS } from '$lib/constants.js';
	import MatchView from '../../../components/MatchView.svelte';
	import type { MatchEvent } from '$lib/types.js';

	/**
	 * The match view as reached from the board: a deep path, one id, and whatever
	 * the board subscription has already put in the store.
	 *
	 * A COLD visit here finds nothing and says so immediately, which is correct
	 * and is why shared links do not point at this route: nothing has subscribed,
	 * so there is no wait to have and nothing on the way. `?npub=…&match=…` lands
	 * on the root page instead, where the subscription and the waiting live.
	 */

	let matchId = $derived($page.params.id ?? '');
	let nowSeconds = $state(Math.floor(Date.now() / 1000));

	// Advance the clock so a match open in this view expires once it ages out,
	// instead of lingering here after the list has dropped it.
	$effect(() => {
		const id = setInterval(() => {
			nowSeconds = Math.floor(Date.now() / 1000);
		}, MATCH_AGE_CHECK_INTERVAL_MS);
		return () => clearInterval(id);
	});

	// Keyed by (organizer, id) and not by id alone, the same as a shared link is.
	// The board subscribes to one author at a time, so this route could get away
	// with the id — but "could get away with" is how the collision arrives, and
	// the organizer is right there in `activePubkey`.
	let match = $derived<MatchEvent | undefined>(
		findMatchByOrganizer($matchesMap, $activePubkey, matchId, nowSeconds)
	);
</script>

<MatchView {match} missing="unresolved" />
