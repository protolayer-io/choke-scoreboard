<script lang="ts">
	import type { MatchEvent, ViewMode } from '$lib/types.js';
	import { getF1Score, getF2Score, getLeader } from '$lib/scoring.js';
	import { sanitizeColor } from '$lib/colors.js';
	import StatusBadge from './StatusBadge.svelte';
	import Timer from './Timer.svelte';
	import { base } from '$app/paths';

	interface Props {
		match: MatchEvent;
		mode: ViewMode;
	}

	let { match, mode }: Props = $props();

	let f1Score = $derived(getF1Score(match));
	let f2Score = $derived(getF2Score(match));
	let leader = $derived(getLeader(match));
	let isCanceled = $derived(match.status === 'canceled');
	let isLive = $derived(match.status === 'in-progress');
	let isFinished = $derived(match.status === 'finished');
	let isBroadcast = $derived(mode === 'broadcast');

	let f1Color = $derived(sanitizeColor(match.f1_color, '#2563eb'));
	let f2Color = $derived(sanitizeColor(match.f2_color, '#dc2626'));
</script>

<a
	href="{base}/match/{match.id}"
	class="block rounded-xl border transition-all duration-200 no-underline hover:scale-[1.01] {isLive ? 'animate-glow-green' : ''} {isCanceled ? 'opacity-50' : ''}"
	style="background-color: var(--bg-card); border-color: {isLive ? 'var(--color-green-live)' : 'var(--border-color)'};"
>
	<!-- Status & Timer Row -->
	<div class="flex items-center justify-between px-4 pt-3 {isBroadcast ? 'px-6 pt-4' : ''}">
		<StatusBadge status={match.status} />
		<Timer {match} />
	</div>

	<!-- Fighters -->
	<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 {isBroadcast ? 'gap-4 p-6' : ''}">
		<!-- Fighter 1 -->
		<div class="text-center">
			<div
				class="mx-auto mb-2 h-1.5 w-16 rounded-full {isBroadcast ? 'h-2 w-24' : ''}"
				style="background-color: {f1Color};"
			></div>
			<p class="truncate font-semibold {isBroadcast ? 'text-lg' : 'text-sm'}" style="color: var(--text-primary);">
				{match.f1_name}
			</p>
			<div class="mt-1 flex items-center justify-center gap-1">
				<span
					class="font-mono font-extrabold {isBroadcast ? 'text-5xl' : 'text-3xl'} {leader === 1 && (isLive || isFinished) ? 'animate-pulse-live' : ''}"
					style="color: var(--text-primary);"
				>
					{f1Score}
				</span>
				{#if isFinished && leader === 1}
					<span class="animate-bounce text-lg">🏆</span>
				{/if}
			</div>
			<!-- Adv & Pen -->
			<div class="mt-1 flex justify-center gap-2 text-xs font-medium">
				{#if match.f1_adv > 0}
					<span class="rounded px-1.5 py-0.5" style="background-color: var(--color-gold, #F5B800); color: #000;">
						A {match.f1_adv}
					</span>
				{/if}
				{#if match.f1_pen > 0}
					<span class="rounded px-1.5 py-0.5 text-white" style="background-color: var(--color-red-penalty, #C0392B);">
						P {match.f1_pen}
					</span>
				{/if}
			</div>
		</div>

		<!-- VS divider -->
		<div class="text-center font-bold" style="color: var(--text-secondary);">
			<span class="{isBroadcast ? 'text-xl' : 'text-sm'}">VS</span>
		</div>

		<!-- Fighter 2 -->
		<div class="text-center">
			<div
				class="mx-auto mb-2 h-1.5 w-16 rounded-full {isBroadcast ? 'h-2 w-24' : ''}"
				style="background-color: {f2Color};"
			></div>
			<p class="truncate font-semibold {isBroadcast ? 'text-lg' : 'text-sm'}" style="color: var(--text-primary);">
				{match.f2_name}
			</p>
			<div class="mt-1 flex items-center justify-center gap-1">
				<span
					class="font-mono font-extrabold {isBroadcast ? 'text-5xl' : 'text-3xl'} {leader === 2 && (isLive || isFinished) ? 'animate-pulse-live' : ''}"
					style="color: var(--text-primary);"
				>
					{f2Score}
				</span>
				{#if isFinished && leader === 2}
					<span class="animate-bounce text-lg">🏆</span>
				{/if}
			</div>
			<!-- Adv & Pen -->
			<div class="mt-1 flex justify-center gap-2 text-xs font-medium">
				{#if match.f2_adv > 0}
					<span class="rounded px-1.5 py-0.5" style="background-color: var(--color-gold, #F5B800); color: #000;">
						A {match.f2_adv}
					</span>
				{/if}
				{#if match.f2_pen > 0}
					<span class="rounded px-1.5 py-0.5 text-white" style="background-color: var(--color-red-penalty, #C0392B);">
						P {match.f2_pen}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Point breakdown (broadcast mode) -->
	{#if isBroadcast}
		<div class="border-t px-6 py-3" style="border-color: var(--border-color);">
			<div class="grid grid-cols-[1fr_auto_1fr] gap-4 text-center text-xs" style="color: var(--text-secondary);">
				<div class="flex justify-center gap-3">
					<span>2pt: {match.f1_pt2}</span>
					<span>3pt: {match.f1_pt3}</span>
					<span>4pt: {match.f1_pt4}</span>
				</div>
				<span>Points</span>
				<div class="flex justify-center gap-3">
					<span>2pt: {match.f2_pt2}</span>
					<span>3pt: {match.f2_pt3}</span>
					<span>4pt: {match.f2_pt4}</span>
				</div>
			</div>
		</div>
	{/if}
</a>
