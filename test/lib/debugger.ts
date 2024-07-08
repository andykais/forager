import * as colors from 'jsr:@std/fmt@0.225.4/colors'


class Debugger {
  static #decoder = new TextDecoder()

  // simple global debug logger that includes the current function name
  static log = (...args: any) => {
    let trace = 1
    if (typeof args[0] === 'object' && Object.keys(args[0]).length === 1 && typeof args[0].trace === 'number') {
      trace = args[0].trace
      args.shift()
    }
    // TODO neat idea: read the source code line to show what is being printed
    const stacktrace = new Error().stack!.split('\n')
    const stacktrace_console_debug_line = stacktrace[2]
    const stacktrace_console_debug_location = stacktrace_console_debug_line.substring(
      stacktrace_console_debug_line.indexOf('file://') + 7,
      stacktrace_console_debug_line.lastIndexOf(':'),
    )
    const stacktrace_console_debug_filepath = stacktrace_console_debug_location.substring(
      0,
      stacktrace_console_debug_location.lastIndexOf(':')
    )
    const stacktrace_console_debug_line_number = parseInt(stacktrace_console_debug_location.substr(
      stacktrace_console_debug_location.lastIndexOf(':') + 1
    ))
    const file_contents = this.#decoder.decode(Deno.readFileSync(stacktrace_console_debug_filepath))
    const stacktrace_console_debug_source_code = file_contents.split('\n')[stacktrace_console_debug_line_number - 1].trim()

    console.log(colors.dim('==================================================='))
    for (let trace_index = trace; trace_index > 0; trace_index--) {
      let code_line = stacktrace[trace_index + 1].trim()
      // trim the path to be relative
      code_line = code_line.replace('file://' + Deno.cwd(), '.')
      const formatted_code_line = `${code_line}`
      console.log(colors.dim(formatted_code_line))
    }

      // // const console_debug_start = formatted_code_line.replace(/console.debug\(.*/, 'console.debug(')
      // // some kind of multipart array slice function would be handy for this sort of thing
      // const console_debug_index_start = formatted_code_line.indexOf('console.debug(')
      // const console_debug_index_end = formatted_code_line.lastIndexOf(')')
      // console.log({formatted_code_line, console_debug_index_start})
      // if (console_debug_index_start !== -1) {
      //   throw new Error('not implementented')
      // } else {
      //   throw new Error('not implementented')
      // }
      // // const console_debug_index_arguments = formatted_code_line.indexOf()


    // a light attepmt at javascript source code parsing inline. What could go wrong (:
    const console_debug_token_start = 'console.debug('
    const console_debug_token_end = ')'
    const console_debug_index_start = stacktrace_console_debug_source_code.indexOf(console_debug_token_start) + console_debug_token_start.length
    const console_debug_index_end = stacktrace_console_debug_source_code.lastIndexOf(console_debug_token_end)
    if (console_debug_index_start === -1 || console_debug_index_end === -1) {
      console.log('   ' + colors.red(stacktrace_console_debug_source_code))
    } else {
      const console_debug_start = stacktrace_console_debug_source_code.substring(0, console_debug_index_start)
      const console_debug_arguments = stacktrace_console_debug_source_code.substring(console_debug_index_start, console_debug_index_end)
      const console_debug_end = stacktrace_console_debug_source_code.substring(console_debug_index_end)
      // console.log({console_debug_index_start, console_debug_index_end, console_debug_arguments, console_debug_end  })
      console.log(`   ${colors.dim(console_debug_start)}${colors.yellow(console_debug_arguments)}${colors.dim(console_debug_end)}`)
    }
    console.log(...args)
    console.log()
  }

  static #console_debug: Console['debug'] | undefined

  static attach_console_debug() {
    if (this.#console_debug) throw new Error('console.debug is already attached')
    this.#console_debug = console.debug
    console.debug = this.log
  }

  static detatch_console_debug() {
    if (!this.#console_debug) throw new Error('console.debug is not attached')
    console.debug = this.#console_debug
    this.#console_debug = undefined
  }
}

export { Debugger }
