/**
  * Spawned by supervisor.test.ts. Kills itself with SIGKILL (like the forager query watchdog does) until it has been launched `kill_times` times
  * usage: supervised_child.ts <counter_file> <kill_times> <exit_code>
  */
const [counter_file, kill_times, exit_code] = Deno.args
let launches = 0
try {
  launches = Number(await Deno.readTextFile(counter_file))
} catch (e) {
  if (!(e instanceof Deno.errors.NotFound)) throw e
}
launches++
await Deno.writeTextFile(counter_file, String(launches))
console.log(`launch ${launches} FORAGER_SUPERVISED=${Deno.env.get('FORAGER_SUPERVISED')}`)
if (launches <= Number(kill_times)) {
  Deno.kill(Deno.pid, 'SIGKILL')
  await new Promise(() => {})
}
Deno.exit(Number(exit_code))
