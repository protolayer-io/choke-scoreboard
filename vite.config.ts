import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
	plugins: [tailwindcss(), sveltekit()],

	// Under test only, resolve as a browser would, so a test can actually mount a
	// component. Vitest resolves for the server by default, where `svelte` is the
	// build that renders to a string and never runs an effect — so the one thing a
	// component test is for, the lifecycle, would silently not happen.
	//
	// This is Vite's own default client list, not a hand-written `['browser']`:
	// `conditions` REPLACES the defaults rather than adding to them, and spelling
	// out only `browser` would quietly drop `module` and `development|production`,
	// sending packages that publish a `module` entry to a lesser one under test.
	//
	// It is deliberately not narrowed to the `svelte` package. This app ships as a
	// static browser bundle, so resolving every dependency the way the browser will
	// is what makes a jsdom test faithful; pinning the rest to their Node entries
	// would test a program nobody runs.
	//
	// Keyed on the mode Vitest runs in, rather than on `process.env`, so the config
	// stays free of Node typings. `vite dev` and `vite build` resolve as they always
	// did: this is a testing concern and must not reach the shipped bundle.
	resolve: mode === 'test' ? { conditions: [...defaultClientConditions] } : undefined
}));
