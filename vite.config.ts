import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
	plugins: [tailwindcss(), sveltekit()],

	// Under test only, resolve Svelte to its browser entry so a test can actually
	// mount a component. Without this `svelte` resolves to the server build, which
	// renders to a string and never runs an effect — so the one thing a component
	// test is for, the lifecycle, would silently not happen.
	//
	// Keyed on the mode Vitest runs in, rather than on `process.env`, so the config
	// stays free of Node typings. `vite dev` and `vite build` resolve as they always
	// did: this is a testing concern and must not reach the shipped bundle.
	resolve: mode === 'test' ? { conditions: ['browser'] } : undefined
}));
