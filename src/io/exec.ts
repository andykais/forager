interface CommandResult {
  stdout: string
  stderr: string
}

const decoder = new TextDecoder()

async function exec(command: (string| number)[]): Promise<CommandResult> {
  const [cmd, ...args] = command.map(arg => arg.toString())
  const proc = new Deno.Command(cmd, { args, stdout: 'piped', stderr: 'piped' })
  const result = await proc.output()
  const command_result: CommandResult = {
   stdout: decoder.decode(result.stdout),
   stderr: decoder.decode(result.stderr),
  }
  if (result.success) return command_result
  else throw new Error(`command failed:\n$ ${command.join(' ')}\nSTDOUT:\n${command_result.stdout}\nSTDERR:\n${command_result.stderr}'`)
}

export { exec }
