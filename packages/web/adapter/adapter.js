import {fileURLToPath} from 'node:url';
import * as fs from 'jsr:@std/fs';
import * as path from 'jsr:@std/path'
import {build} from 'npm:esbuild';

/** @type {import('.').default} */
export default function (opts = {}) {
  const {buildOptions = {}} = opts;

  return {
    name: 'deno-deploy-adapter',

    async adapt(builder) {
      const web_package_root = path.resolve(import.meta.dirname, '..')
      const published_package_dir = path.join(web_package_root, 'adapter', 'lib')
      const out = path.join(published_package_dir, 'build')
      const tmp = builder.getBuildDirectory('deno-deploy-adapter');

      builder.rimraf(out);
      builder.rimraf(tmp);
      builder.mkdirp(tmp);

      const out_server_dir = path.join(out, 'server')
      const out_static_dir = path.join(out, 'static')
      const out_static_kit_dir = path.join(out_static_dir, builder.config.kit.paths.base)

      builder.writeClient(out_static_kit_dir);
      builder.writePrerendered(out_static_kit_dir);
      builder.writeServer(out_server_dir);

      builder.copy(path.join(web_package_root, 'src/lib/server/config.ts'), path.join(out, 'config.ts'))

      const deno_json = JSON.parse(await Deno.readTextFile(path.join(published_package_dir, 'deno.json')))

      const js_static_imports = {}
      const build_manifest = {
        package_version: deno_json.version,
        APP_DIR: builder.getAppPath(),
        PRERENDERED: builder.prerendered.paths,
        generated_files: {},
      }

      const vite_generated_build_files = [
        // ...await Array.fromAsync(fs.walk(out_server_dir, {includeDirs: false})),
        ...await Array.fromAsync(fs.walk(out_static_dir, {includeDirs: false})),
      ]

      for await (const file of vite_generated_build_files) {
        const relative_path = path.relative(out, file.path)
        const file_id = relative_path.replaceAll(/[^a-zA-Z0-9]/g, '_')
        if (js_static_imports[file_id]) {
          throw new Error(`Naming conflict on build asset ${relative_path} on file_id ${file_id} with ${js_static_imports[file_id]}`)
        }
        build_manifest.generated_files[file_id] = relative_path
        js_static_imports[file_id] = `import ${file_id} from './${relative_path}' with { type: 'bytes' }`
      }

      const js_static_import_file = [...Object.values(js_static_imports)].join('\n')
      await Deno.writeTextFile(path.join(out, 'bytes_imports.ts'), js_static_import_file)
      await Deno.writeTextFile(path.join(out, 'build.json'), JSON.stringify(build_manifest, null, 2))

      /*
      // transpile build/server.js and build/server/* into a single esm compatible bundle
      const defaultOptions = {
        entryPoints: [`${out}/server.js`],
        outfile: `${out}/server.js`,
        bundle: true,
        format: 'esm',
        target: 'esnext',
        platform: 'node',
        allowOverwrite: true
      };

      for (const key of Object.keys(buildOptions)) {
        if (Object.hasOwn(defaultOptions, key)) {
          console.warn(
            `Warning: "buildOptions" has override for default "${key}" this may break deployment.`
          );
        }
      }

      try {
        await build({
          ...defaultOptions,
          ...buildOptions
        });
      } catch (err) {
        console.error(err);
        process.exit(1);
      } finally {
        // builder.rimraf(`${out}/server`);
      }
      */
    }
  };
}
