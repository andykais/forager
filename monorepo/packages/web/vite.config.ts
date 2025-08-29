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

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), deno()],
  resolve: {
    alias: {
      ...resolve_workspace_imports('core'),
    }
  }
});
