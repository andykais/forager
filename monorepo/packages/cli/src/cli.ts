import * as cliffy from '@cliffy/command'
import * as forager from '@forager/core'
import deno_json from '../deno.json' with { type: "json" };
import { ForagerHelpers } from './helpers.ts'

const LOG_LEVEL_TYPE = new cliffy.EnumType(["debug", "info", "error"]);


const cli = new cliffy.Command()
  .name("forager")
  .description("A command line interface to @forager/core")
  .version(deno_json.version)
  .option('--config=<config>', 'The path to a config file. If not specified, forager will look in the default config directory', {global: true})
  .type("log-level", LOG_LEVEL_TYPE)
  .option('-l, --log-level <level:log-level>', 'The log level forager will output.', { default: 'info', global: true })
  .option('-q, --quiet', 'Shorthand for --log-level=error', { global: true })

  .command('foo', 'foo desc')

  .command('init', 'Initialize a forager database and set up a config file')
    .action(async opts => {
      const forager_helpers = new ForagerHelpers(opts)
      await forager_helpers.ensure_config()
    })

  .command('search', 'search for media in the forager database')
    .option('--tags=<tags>', 'A comma separated list of tags to search with')
    .action(async opts => {
      throw new Error('unimplemented')
    })

  .command('discover <globpath>', 'Discover media with a provided glob to the forager database')
    .option('--exts=<extensions>', 'A comma separated list of file extensions to look for')
    .action(async (opts) => {
      throw new Error('unimplemented')
    })

  .command('create <filepath>', 'add a file to the forager database')
    .option('--tags=<tags>', 'A comma separated list of tags to create media with')
    .action(async (opts, filepath) => {
      console.log({opts})
      const forager_helpers = new ForagerHelpers(opts)
      await forager_helpers.ensure_config()

      throw new Error('unimplemented')
    })

await cli.parse()
