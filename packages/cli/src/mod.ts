import { cliffy } from "./deps.ts";
import deno_json from './deno.json' with { type: "json" };

const LOG_LEVEL_TYPE = new cliffy.EnumType(["debug", "info", "error"]);


const cli = new cliffy.Command()
  .name("forager")
  .description("A command line interface to @forager/core")
  .version(deno_jsonc.version)
  .command('search', 'search for media in the forager database')
  // .arguments('<executable:string>')
  // .type("log-level", LOG_LEVEL_TYPE)
  // .option('-l, --log-level <level:log-level>', 'The log level demon will output.', { default: 'info' })
  // .option('-q, --quiet', 'Shorthand for --log-level=error')
  // .option('--level <level:string>', 'The log level demon will output.')
  // .option('--watch <watch:string>', 'A comma separated list of files and directories to watch')
  // .option('--ext, --extensions <ext:string>', 'A comma separated list of file extensions to watch')
  // .option('--ignore <pattern:string>', 'A regex file pattern to filter down files')
  // .option('--pattern <pattern:string>', 'A regex file pattern to filter down files')
  // .option('--disable-queued-execution', 'By default, if a file watch event happens while a command is executing, demon will execute the command again after it completes. Use this flag to disable that behavior')
  // .option('--disable-clear-screen', 'By default, demon will clear the terminal screen before retriggering a command. Use this flag to disable that behavior')
  .action(async (opts, executable) => {
    const file_watchlist: string[] = []
    const file_pattern_ignore_regexes: RegExp[] = []
    const file_pattern_regexes: RegExp[] = []

    // seems like cliffy's type() tool is busted so we have to manually cast logLevel
    setup_logger(opts.quiet ? 'error' : opts.logLevel as 'debug' | 'info' | 'error')

    // TODO handle file globs: current plan is to read in a watchlist, and if an item is not an existing file/directory attempt to read it as a glob (which I still need a library for)
    if (opts.pattern) {
      file_pattern_regexes.push(new RegExp(opts.pattern))
    }

    if (opts.ignore) {
      file_pattern_ignore_regexes.push(new RegExp(opts.ignore))
    }

    if (opts.watch) {
      file_watchlist.push(...opts.watch.split(','))
    }
    if (opts.ext) {
      for (const ext of opts.ext.split(',')) {
        file_pattern_regexes.push(new RegExp(`\.${ext}$`))
      }
      if (file_watchlist.length === 0) {
        file_watchlist.push('.')
      }
    }

    if (await std_fs.exists(executable)) {
      file_watchlist.push(executable)
    }

    const stateful_executor = new StatefulExecutor({
      file_pattern_ignore_regexes,
      file_pattern_regexes,
      file_watchlist,
      executable,
      opts,
    })

    await stateful_executor.execute()

    while (true) {
      const watcher = Deno.watchFs(file_watchlist)
      for await (const event of watcher) {
        stateful_executor.file_watch_event(event)

        // editors like neovim swap out files when they write them. The OS watcher (linux at least w/ inotifywait) cant track files after that swap happens so we restart the watcher when we see one
        if (event.kind === 'remove') {
          watcher.close()
        }
      }
    }
  })

await cli.parse()

