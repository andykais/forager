import adapter from './adapter/adapter.js'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
    // resolve @forager/core to its TypeScript source so svelte-check can infer types
    // across the workspace. Declaring these here (rather than as `paths` in
    // tsconfig.json) lets `svelte-kit sync` generate them into
    // .svelte-kit/tsconfig.json alongside the $lib/$app aliases, so there is no
    // hand-maintained copy to keep in sync.
    alias: {
      '@forager/core': '../core/src/mod.ts',
      '~': '../core/src',
    },
    prerender: {
      crawl: false,
			entries: []
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
