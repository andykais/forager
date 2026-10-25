import * as path from '@std/path'
import { test } from 'forager-test'
import { supervise } from '../src/supervisor.ts'


const CHILD_SCRIPT = path.join(import.meta.dirname!, 'lib', 'supervised_child.ts')

function supervise_child(counter_file: string, kill_times: number, exit_code: number, logs: string[]) {
  return supervise({
    command: Deno.execPath(),
    args: ['run', '--allow-read', '--allow-write', '--allow-env', CHILD_SCRIPT, counter_file, String(kill_times), String(exit_code)],
    max_restarts: 3,
    restart_delay_ms: 10,
    log: message => logs.push(message),
  })
}

test('supervisor', async ctx => {
  await Deno.mkdir(ctx.fixture_folder, { recursive: true })

  await ctx.subtest('restarts a process killed with SIGKILL, then passes through its exit code', async () => {
    const counter_file = ctx.create_fixture_path('restarts.txt')
    const logs: string[] = []
    const result = await supervise_child(counter_file, 2, 3, logs)
    ctx.assert.equals(result, { code: 3, restarts: 2 })
    ctx.assert.equals(await Deno.readTextFile(counter_file), '3')
    ctx.assert.equals(logs.length, 2)
    ctx.assert.match(logs[0], /process \d+ was killed \(SIGKILL\), restarting in 10ms/)
  })

  await ctx.subtest('does not restart a process that exits on its own', async () => {
    const counter_file = ctx.create_fixture_path('clean_exit.txt')
    const logs: string[] = []
    const result = await supervise_child(counter_file, 0, 0, logs)
    ctx.assert.equals(result, { code: 0, restarts: 0 })
    ctx.assert.equals(logs, [])
  })

  await ctx.subtest('gives up after too many restarts', async () => {
    const counter_file = ctx.create_fixture_path('crash_loop.txt')
    const logs: string[] = []
    const result = await supervise_child(counter_file, 100, 0, logs)
    ctx.assert.equals(result, { code: 137, restarts: 3 })
    ctx.assert.equals(await Deno.readTextFile(counter_file), '4')
    ctx.assert.match(logs.at(-1)!, /process was killed 4 times within \d+ms, giving up/)
  })

  await ctx.subtest('marks the child as supervised', async () => {
    const counter_file = ctx.create_fixture_path('env.txt')
    const output = await new Deno.Command(Deno.execPath(), {
      args: ['eval', `
        import { supervise } from ${JSON.stringify(path.toFileUrl(path.join(import.meta.dirname!, '..', 'src', 'supervisor.ts')).href)}
        await supervise({ command: Deno.execPath(), args: ['run', '-A', ${JSON.stringify(CHILD_SCRIPT)}, ${JSON.stringify(counter_file)}, '0', '0'] })
      `],
      stdout: 'piped',
    }).output()
    ctx.assert.equals(new TextDecoder().decode(output.stdout).trim(), 'launch 1 FORAGER_SUPERVISED=1')
  })
})
