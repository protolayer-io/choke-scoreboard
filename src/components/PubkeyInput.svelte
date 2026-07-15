<script lang="ts">
	import { onMount } from 'svelte';
	import {
		decodePubkey,
		encodePubkey,
		subscribeToMatches,
		closeSubscription,
		PubkeyError,
		type PubkeyErrorCode
	} from '$lib/nostr.js';
	import { t, type MessageKey } from '$lib/i18n/index.js';
	import {
		activePubkey,
		clearMatches,
		debugMode,
		isLoading,
		matchesMap,
		persistPubkey,
		loadPersistedPubkey,
		clearPersistedPubkey
	} from '$lib/stores.js';
	import { getDebugMatches } from '$lib/debug-matches.js';
	import type { MatchEvent } from '$lib/types.js';

	/**
	 * Why the last attempt failed, as a message key rather than a sentence.
	 *
	 * Holding the key and not the text is what lets the error follow a language
	 * change: translate it once at the catch and it would sit there in the old
	 * language until the user typed something wrong again.
	 */
	const PUBKEY_ERRORS = {
		'invalid-npub': 'pubkey.error.invalidNpub',
		'invalid-pubkey': 'pubkey.error.invalidPubkey'
	} as const satisfies Record<PubkeyErrorCode, MessageKey>;

	type PubkeyErrorKey = (typeof PUBKEY_ERRORS)[PubkeyErrorCode];

	let inputValue = $state('');
	let errorKey = $state<PubkeyErrorKey | ''>('');

	function connectToPubkey(hex: string): void {
		clearMatches();
		debugMode.set(false);
		activePubkey.set(hex);
		persistPubkey(hex);
		subscribeToMatches(hex);
	}

	function handleLoad(): void {
		errorKey = '';
		try {
			const hex = decodePubkey(inputValue);
			connectToPubkey(hex);
		} catch (e) {
			errorKey = e instanceof PubkeyError ? PUBKEY_ERRORS[e.code] : 'pubkey.error.invalidPubkey';
		}
	}

	function handleDebug(): void {
		errorKey = '';
		closeSubscription();
		clearMatches();
		clearPersistedPubkey();
		debugMode.set(true);
		activePubkey.set('debug');
		isLoading.set(false);

		const matches = getDebugMatches();
		matchesMap.set(new Map<string, MatchEvent>(matches.map((m) => [m.id, m])));
	}

	function handleDisconnect(): void {
		closeSubscription();
		clearMatches();
		clearPersistedPubkey();
		debugMode.set(false);
		activePubkey.set('');
		inputValue = '';
		errorKey = '';
	}

	let connected = $state(false);
	let connectedDisplay = $state('');

	$effect(() => {
		const unsub = activePubkey.subscribe((pk) => {
			connected = pk !== '';
			if (pk && pk !== 'debug') {
				try {
					connectedDisplay = encodePubkey(pk);
				} catch {
					connectedDisplay = pk.slice(0, 8) + '...' + pk.slice(-8);
				}
			} else {
				connectedDisplay = '';
			}
		});
		return unsub;
	});

	onMount(() => {
		const saved = loadPersistedPubkey();
		if (saved && saved.length > 0) {
			try {
				inputValue = encodePubkey(saved);
			} catch {
				inputValue = saved;
			}
			connectToPubkey(saved);
		}
	});
</script>

<div class="mx-auto w-full max-w-2xl space-y-3">
	{#if !connected}
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={inputValue}
				placeholder={$t('pubkey.placeholder')}
				class="flex-1 rounded-lg border px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2"
				style="background-color: var(--bg-input); border-color: var(--border-color); color: var(--text-primary); --tw-ring-color: var(--color-green-live);"
				onkeydown={(e) => e.key === 'Enter' && handleLoad()}
			/>
			<button
				onclick={handleLoad}
				class="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
				style="background-color: var(--color-green-live, #1BA34E);"
			>
				{$t('pubkey.load')}
			</button>
		</div>
		<div class="flex items-center justify-between">
			{#if errorKey}
				<p class="text-sm" style="color: var(--color-red-penalty);">{$t(errorKey)}</p>
			{:else}
				<div></div>
			{/if}
			<button
				onclick={handleDebug}
				class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
				style="background-color: var(--bg-input); color: var(--text-secondary);"
			>
				{$t('pubkey.debugMode')}
			</button>
		</div>
	{:else}
		<!-- Connection pill (design 2A): glowing dot, the npub in a mono face,
		     and a red Disconnect. -->
		<div
			class="flex items-center justify-between gap-3.5"
			style="padding: 13px 16px 13px 20px; border-radius: 12px; background: var(--pill-bg); border: 1px solid var(--pill-border);"
		>
			<div class="flex min-w-0 items-center" style="gap: 11px;">
				<span
					class="flex-none rounded-full"
					style="width: 9px; height: 9px; background: #16c05f; box-shadow: 0 0 12px #16c05f;"
				></span>
				<span
					class="truncate"
					style="font-family: 'Chakra Petch', monospace; font-weight: 500; font-size: 16px; color: var(--text-secondary);"
					>{connectedDisplay || $t('pubkey.connected')}</span
				>
			</div>
			<button
				onclick={handleDisconnect}
				class="flex-none cursor-pointer transition-colors hover:opacity-80"
				style="padding: 9px 18px; border-radius: 9px; background: var(--danger-bg); border: 1px solid var(--danger-border); font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .05em; color: var(--danger-text);"
			>
				{$t('pubkey.disconnect')}
			</button>
		</div>
	{/if}
</div>
