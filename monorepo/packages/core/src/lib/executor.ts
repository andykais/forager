class Executor {
  #encoder: TextEncoder
  #decoder: TextDecoder
  #command: string
  #cmd: Deno.Command

  constructor(command: string) {
    this.#encoder = new TextEncoder()
    this.#decoder = new TextDecoder()
    this.#command = command
    this.#cmd = new Deno.Command('sh', {
      args: ['-c', command],
      stdout: 'piped',
      stderr: 'piped',
    })
  }

  async execute() {
    const start_time = performance.now()
    log.info(`Executing "${this.#command}"`)
    const proc = this.#cmd.spawn()
    await Promise.all([
      (async () => {
        for await (const line of proc.stdout) {
          Deno.stdout.write(this.#encoder.encode(this.#decoder.decode(line)))
        }
      })(),
      (async () => {
        for await (const line of proc.stderr) {
          const formatted_error_line = std_colors.red(this.#decoder.decode(line))
          Deno.stderr.write(this.#encoder.encode(formatted_error_line))
        }
      })(),
    ])
    const result = await proc.status
    const execution_duration_ms = performance.now() - start_time
    const duration_pretty = `${(execution_duration_ms / 1000).toFixed(2)} seconds`
    if (result.success) {
      log.info(`Command exited with code ${result.code} after ${duration_pretty}`)
    } else {
      let exit_code_description = `${result.code}`
      if (result.signal) exit_code_description += `- ${result.signal}`
      log.warn(`Command exited with code ${exit_code_description} after ${duration_pretty}`)
    }
  }
}
