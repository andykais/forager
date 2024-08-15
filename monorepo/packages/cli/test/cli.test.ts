import * as path from '@std/path'
import { ForagerConfig } from '@forager/core'
import { test } from 'forager-test'

async function forager_exec(...args: string[]) {
  const cmd = new Deno.Command('deno', {
    cwd: path.resolve(import.meta.dirname!, '..'),
    args: [
      'run',
      '--check',
      '-A',
      '--unstable-ffi',
      'src/cli.ts',
      ...args
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const status = await cmd.output()
}

test('cli basics', async ctx => {
  await ctx.subtest('create subcommand', async () => {
    const forager_config: ForagerConfig = {
      database_path: ctx.create_fixture_path('forager.db'),
      thumbnail_folder: ctx.create_fixture_path('thumbnails'),
    }
    const forager_config_path = ctx.create_fixture_path('forager.yml')
    await Deno.writeTextFile(forager_config_path, JSON.stringify(forager_config))
    await forager_exec('create', '--config', forager_config_path, ctx.resources.media_files["cat_doodle.jpg"])
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
