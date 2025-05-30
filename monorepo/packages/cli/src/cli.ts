import * as cliffy from '@cliffy/command'
import {Forager, type ForagerConfig} from '@forager/core'
import * as web from '@forager/web'
import deno_json from '../deno.json' with { type: "json" };
import { ForagerHelpers } from './helpers.ts'

const LOG_LEVEL_TYPE = new cliffy.EnumType(["DEBUG", "INFO", "ERROR", 'SILENT']);


const cli = new cliffy.Command()
  .name("forager")
  .description("A command line interface to @forager/core")
  .version(deno_json.version)
  .option('--config=<config>', 'The path to a config file. If not specified, forager will look in the default config directory', {global: true})
  .type("log-level", LOG_LEVEL_TYPE)
  .option('-l, --log-level <level:log-level>', 'The log level forager will output.', { default: 'INFO', global: true })
  .option('--json', 'Silence logs and print structured json after a command completes', { global: true })
  .option('-q, --quiet', 'Shorthand for --log-level=SILENT', { global: true })

  .command('init', 'set up a forager config file and initialize a the database')
    .action(async opts => {
      const forager_helpers = new ForagerHelpers(opts)
      const forager = await forager_helpers.launch_forager()
      const server = new web.Server({
        asset_folder: forager_helpers.config.web.asset_folder,
        port: forager_helpers.config.web.port,
        log_level: forager_helpers.config.web.log_level,
        kit: {
          env: {
            FORAGER_INSTANCE: forager as any,
            FORAGER_CONFIG: forager_helpers.config as any,
          }
        }
      })
      await server.init()
    })

  .command('search', 'search for media in the forager database')
    .option('--tags=<tags>', 'A comma separated list of tags to search with')
    .option('--directory=<directory>', 'Find media files in forager within a directory on the file system')
    .option('--media-reference-id=<media_reference_id:number>', 'A forager database media reference id')
    .action(async opts => {
      const forager_helpers = new ForagerHelpers(opts)
      const forager = await forager_helpers.launch_forager()
      const result = forager.media.search({
        query: {
          media_reference_id: opts.mediaReferenceId,
          directory: opts.directory,
          tags: opts.tags?.split(','),
        }
      })
      forager_helpers.print_output(result)
    })

  .command('discover <globpath>', 'add media to the forager database with a provided file glob')
    .option('--tags=<tags>', 'A comma separated list of tags to set on media')
    .option('--exts=<extensions>', 'A comma separated list of file extensions to look for')
    .action(async (opts, globpath) => {
      const forager_helpers = new ForagerHelpers(opts)
      const forager = await forager_helpers.launch_forager()
      const extensions = opts.exts?.split(',')
      if (opts.tags) {
        throw new Error('unimplemented')
      }
      const result = await forager.filesystem.discover({ path: globpath, extensions })
      forager_helpers.print_output(result)
    })

  .command('create <filepath>', 'add a file to the forager database')
    .option('--title=<title>', 'The title of a piece of media')
    .option('--tags=<tags>', 'A comma separated list of tags to create media with')
    .action(async (opts, filepath) => {
      const forager_helpers = new ForagerHelpers(opts)
      const forager = await forager_helpers.launch_forager()
      const tags = opts.tags?.split(',')
      const result = await forager.media.create(filepath, {
        title: opts.title,
      }, tags)
      forager_helpers.print_output(result)
    })

  .command('delete', 'delete a file from the forager database')
    .option('--filepath=<filepath>', 'Match media based on a filepath')
    .option('--media-reference-id=<media_reference_id:number>', 'Match media based on a MediaReference::id')
    .action(async (opts) => {
      const forager_helpers = new ForagerHelpers(opts)
      const forager = await forager_helpers.launch_forager()
      await forager.media.delete({
        filepath: opts.filepath,
        media_reference_id: opts.mediaReferenceId,
      })
    })

  .command('gui', 'launch the forager graphical web interface')
    .option('--port=<port:number>', 'The port the web app will be hosted from')
    .action(async (opts) => {
      const forager_helpers = new ForagerHelpers(opts)
      const forager = await forager_helpers.launch_forager()
      const server = new web.Server({
        asset_folder: forager_helpers.config.web.asset_folder,
        port: forager_helpers.config.web.port,
        log_level: forager_helpers.config.web.log_level,
        kit: {
          env: {
            FORAGER_INSTANCE: forager as any,
            // FORAGER_CONFIG: forager_helpers.config_filepath,
          }
        }
      })
      await server.init()
      await server.start()
    })


await cli.parse()
