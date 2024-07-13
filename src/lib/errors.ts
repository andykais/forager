class BadInputError extends Error {
  name = 'BadInputError'
}

class NotFoundError extends Error {
  name = 'NotFoundError'

  constructor(model: string, query_name: string, params: any) {
    super(`${model} "${JSON.stringify(params)}" does not exist (queried with ${query_name})`)
  }
}

class DuplicateMediaError extends Error {
  name = 'DuplicateMediaError'

  constructor(filepath: string, checksum: string) {
    super(`file '${filepath}' checksum ${checksum} already exists`)
  }
}

class SubprocessError extends Error {
  name = 'SubprocessError'
  public output: Deno.CommandOutput
  public constructor(output: Deno.CommandOutput, message: string) {
    const decoder = new TextDecoder()
    const stdout = decoder.decode(output.stdout)
    const stderr = decoder.decode(output.stderr)
    super(`${message}\n\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`)
    this.output = output
  }
}

class UnExpectedError extends Error {
  name = 'UnExpectedError'
}

export { BadInputError, NotFoundError, DuplicateMediaError, SubprocessError, UnExpectedError }
