import * as fs from 'jsr:@std/fs'
import * as path from 'jsr:@std/path'

/**
 * Custom SvelteKit adapter for @forager/web.
 *
 * As of phase 3 of the Tauri port, this adapter produces a pure static SPA
 * (equivalent to @sveltejs/adapter-static with `fallback: 'index.html'`).
 * The bytes-imports machinery is retained so the static assets can be
 * embedded inside a `deno compile`-built CLI binary.
 *
 * Output layout (relative to packages/web/adapter/lib/build):
 *   static/                        — client assets + SPA fallback (index.html)
 *   bytes_imports.ts               — `with { type: 'bytes' }` re-exports of every static file
 *   build.json                     — manifest used by mod.ts at runtime
 */
export default function () {
  return {
    name: 'forager-static-adapter',

    async adapt(builder) {
      const web_package_root = path.resolve(import.meta.dirname, '..')
      const published_package_dir = path.join(web_package_root, 'adapter', 'lib')
      const out = path.join(published_package_dir, 'build')

      builder.rimraf(out)
      builder.mkdirp(out)

      const out_static_dir = path.join(out, 'static')
      const out_static_kit_dir = path.join(out_static_dir, builder.config.kit.paths.base)

      builder.writeClient(out_static_kit_dir)
      builder.writePrerendered(out_static_kit_dir)
      await builder.generateFallback(path.join(out_static_kit_dir, 'index.html'))

      const deno_json = JSON.parse(await Deno.readTextFile(path.join(published_package_dir, 'deno.json')))
      const LOCAL_BUILD = Deno.env.get('LOCAL_BUILD')
      const package_version = LOCAL_BUILD
        ? `local_build_${Date.now()}`
        : deno_json.version

      const js_static_imports = {}
      const build_manifest = {
        package_version,
        APP_DIR: builder.getAppPath(),
        SPA_FALLBACK: 'index.html',
        generated_files: {},
      }

      const vite_generated_build_files = await Array.fromAsync(
        fs.walk(out_static_dir, { includeDirs: false }),
      )

      for (const file of vite_generated_build_files) {
        const relative_path = path.relative(out, file.path)
        const file_id = relative_path.replaceAll(/[^a-zA-Z0-9]/g, '_')
        if (js_static_imports[file_id]) {
          throw new Error(`Naming conflict on build asset ${relative_path} on file_id ${file_id} with ${js_static_imports[file_id]}`)
        }
        build_manifest.generated_files[file_id] = path.relative(out_static_dir, file.path)
        js_static_imports[file_id] = `export { default as ${file_id} } from './${relative_path}' with { type: 'bytes' }`
      }

      const js_static_import_file = [...Object.values(js_static_imports)].join('\n')
      await Deno.writeTextFile(path.join(out, 'bytes_imports.ts'), js_static_import_file)
      await Deno.writeTextFile(path.join(out, 'build.json'), JSON.stringify(build_manifest, null, 2))
    },
  }
}
