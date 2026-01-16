import * as path from 'node:path'
import deno from '@deno/vite-plugin'
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const monorepo_root = path.resolve(__dirname, '..', '..')

/** convert jsr dependencies like `jsr:@torm/sqlite@^1.9.7` to npm depedencies like `node_modules/@jsr/torm__sqlite`.
  * Note that npm depedencies like you may put into package.json like `npm:@jsr/torm__sqlite@^1.9.7` do _not_ work */
function resolve_workspace_imports(workspace_package: string) {
  const package_root = path.join(monorepo_root, 'packages', workspace_package)
  const denojson = JSON.parse(new TextDecoder().decode(Deno.readFileSync(path.join(package_root, 'deno.json'))))
  const resolved_imports: Record<string, string> = {}

  for (const [package_alias, specifier] of Object.entries(denojson.imports)) {
    if (specifier.startsWith('jsr:')) {

      const local_equivilant = `node_modules/@jsr/` + specifier.replace('jsr:', '').replace(/^@/, '').replace('/', '__').replace(/@.*/, '')
      resolved_imports[package_alias] = path.join(monorepo_root, local_equivilant)

    } else if (package_alias.startsWith('~/')) {

      resolved_imports[package_alias] = path.join(monorepo_root, 'packages/core/src') + path.sep

    } else {

      throw new Error(`unimplemented resolve for ${package_alias}: ${specifier}`)
    }
  }
  return resolved_imports
}

// Patch the deno plugin(s) to skip virtual modules (which start with \0)
function patchedDeno() {
	const denoPlugins = deno()
	const plugins = Array.isArray(denoPlugins) ? denoPlugins : [denoPlugins]

	// Patch each plugin that has a resolveId hook
	for (const plugin of plugins) {
		if (plugin.resolveId) {
			const originalResolveId = plugin.resolveId
			plugin.resolveId = function(source, importer, options) {
				// Skip virtual modules - they should be handled by Vite itself
				if (source.startsWith('\0')) {
					return null
				}
				return originalResolveId.call(this, source, importer, options)
			}
		}
	}

	return denoPlugins
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), patchedDeno()],
  resolve: {
    alias: {
      ...resolve_workspace_imports('core'),
    }
  },
  server: {
    fs: {
      allow: [
        // allow the workspace root node_modules folder (this is not auto detected by vite like a package.json "workspaces" would be)
        path.join(path.resolve(__dirname, '..', '..'), 'node_modules'),
      ]
    },

    host: '127.0.0.1', // Only bind to localhost'

    // // NOTE that this disables hmr and hard server refresh.
    // // refreshing manually may be a better iterative workflow
    // hmr: {
    //   port: false,
    //   clientPort: false
    // }
  }
});
