class NotFoundError extends Error {
  constructor(model: string, query: any) {
    super(`${model} "${JSON.stringify(query)}" does not exist`)
  }
}

class DuplicateMediaError extends Error {
  constructor(filepath: string, checksum: string) {
    super(`file '${filepath}' checksum ${checksum} already exists`)
  }
}


class SubprocessError extends Error {
  public output: Deno.CommandOutput
  public constructor(output: Deno.CommandOutput, message: string) {
    const decoder = new TextDecoder()
    const stdout = decoder.decode(output.stdout)
    const stderr = decoder.decode(output.stderr)
    super(`${message}\n\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`)
    this.output = output
  }
}

export { NotFoundError, DuplicateMediaError, SubprocessError }
