import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],

  // NOTE that this disables hmr and hard server refresh.
  // refreshing manually may be a better iterative workflow
  server: {
    hmr: {
      port: false,
      clientPort: false
    }
  }
});
