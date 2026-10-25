const SUPERVISED_ENV_VAR = 'FORAGER_SUPERVISED'

interface SupervisorOptions {
  command: string
  args: string[]
  /** restarts allowed within `restart_window_ms` before the supervisor gives up */
  max_restarts?: number
  restart_window_ms?: number
  restart_delay_ms?: number
  log?: (message: string) => void
}

interface SupervisorResult {
  code: number
  restarts: number
}

interface SupervisedCommand {
  command: string
  args: string[]
}

/** True when this process was spawned by {@linkcode supervise} */
function is_supervised_process(): boolean {
  const permission = Deno.permissions.querySync({ name: 'env', variable: SUPERVISED_ENV_VAR })
  return permission.state === 'granted' && Deno.env.get(SUPERVISED_ENV_VAR) === '1'
}

/**
  * The command that re-launches this exact process, or a reason why it cannot be determined.
  */
function resolve_supervised_command(): SupervisedCommand | { unsupported: string } {
  const command = Deno.execPath()
  const permission = Deno.permissions.querySync({ name: 'run', command })
  if (permission.state !== 'granted') {
    return { unsupported: `missing run permission for ${command} (grant it with --allow-run)` }
  }
  if (Deno.build.standalone) {
    return { command, args: Deno.args }
  }
  if (Deno.build.os !== 'linux') {
    return { unsupported: `restarting a process launched with 'deno run' is only supported on linux (try a compiled forager binary)` }
  }
  // `deno run` does not expose its permission flags, but linux records the exact argv we were launched with
  try {
    const argv = Deno.readTextFileSync('/proc/self/cmdline').split('\0').slice(0, -1)
    return { command, args: argv.slice(1) }
  } catch (e) {
    if (e instanceof Deno.errors.NotCapable) {
      return { unsupported: `restarting a process launched with 'deno run' requires --allow-all (deno only allows reading /proc/self/cmdline with it)` }
    }
    throw e
  }
}

/**
  * Run a command, restarting it whenever it is killed with SIGKILL (which is how the forager query watchdog stops a stuck query).
  * Any other exit ends supervision and is passed through as the result.
  */
async function supervise(options: SupervisorOptions): Promise<SupervisorResult> {
  const max_restarts = options.max_restarts ?? 5
  const restart_window_ms = options.restart_window_ms ?? 10 * 60 * 1000
  const restart_delay_ms = options.restart_delay_ms ?? 1000
  const log = options.log ?? ((message: string) => console.error(`[forager supervisor] ${message}`))

  let shutting_down = false
  let child: Deno.ChildProcess | undefined
  // the terminal delivers ctrl-c to the child as well, so we just wait for it to exit
  const on_sigint = () => { shutting_down = true }
  const on_sigterm = () => {
    shutting_down = true
    child?.kill('SIGTERM')
  }
  Deno.addSignalListener('SIGINT', on_sigint)
  if (Deno.build.os !== 'windows') Deno.addSignalListener('SIGTERM', on_sigterm)

  const restarted_at: number[] = []
  try {
    while (true) {
      child = new Deno.Command(options.command, {
        args: options.args,
        env: { [SUPERVISED_ENV_VAR]: '1' },
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      }).spawn()
      const status = await child.status

      if (shutting_down || status.signal !== 'SIGKILL') {
        return { code: status.code, restarts: restarted_at.length }
      }

      const now = Date.now()
      const recent_restarts = restarted_at.filter(timestamp => now - timestamp < restart_window_ms)
      if (recent_restarts.length >= max_restarts) {
        log(`process was killed ${recent_restarts.length + 1} times within ${restart_window_ms}ms, giving up`)
        return { code: status.code, restarts: restarted_at.length }
      }
      log(`process ${child.pid} was killed (SIGKILL), restarting in ${restart_delay_ms}ms`)
      await new Promise(resolve => setTimeout(resolve, restart_delay_ms))
      if (shutting_down) return { code: status.code, restarts: restarted_at.length }
      restarted_at.push(Date.now())
    }
  } finally {
    Deno.removeSignalListener('SIGINT', on_sigint)
    if (Deno.build.os !== 'windows') Deno.removeSignalListener('SIGTERM', on_sigterm)
  }
}

export { supervise, is_supervised_process, resolve_supervised_command, SUPERVISED_ENV_VAR }
export type { SupervisorOptions, SupervisorResult }
