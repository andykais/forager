import * as path from '@std/path'
import { test } from 'forager-test'

async function forager_exec(...args: string[]) {
  const cmd = new Deno.Command('deno', {
    cwd: path.resolve(import.meta.dirname!, '..'),
    args: [
      'run',
      '--check',
      '-A',
      '--unstable-ffi',
      'src/mod.ts',
      ...args
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const status = await cmd.output()
}

test('cli basics', async ctx => {
  await ctx.subtest('create subcommand', async () => {
    await forager_exec('create', ctx.resources.media_files["cat_doodle.jpg"])
    // const cmd = new Deno.Command('forager', {
    //   args: ['create', ctx.resources.media_files["cat_doodle.jpg"]],
    //   stdout: 'inherit',
    //   stderr: 'inherit',
    // })
    // const status = await cmd.output()
    // console.debug(status)
    // ctx.assert.equals(status.code, 0)
    // ctx.assert.equals(status.success, true)
  })
})
