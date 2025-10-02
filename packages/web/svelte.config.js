import adapter from './adapter/adapter.js'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
    experimental: {
      remoteFunctions: true,
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
