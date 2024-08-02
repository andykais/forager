export class BadInputError extends Error {
  name = 'BadInputError'
}

export class NotFoundError extends Error {
  name = 'NotFoundError'

  constructor(model: string, query_name: string, params: any) {
    super(`${model} "${JSON.stringify(params)}" does not exist (queried with ${query_name})`)
  }
}

export class DuplicateMediaError extends Error {
  name = 'DuplicateMediaError'

  constructor(public filepath: string, public checksum: string, public existing_media_filepath: string) {
    super(`file '${filepath}' checksum ${checksum} is a duplicate of ${existing_media_filepath}`)
  }
}

export class MediaAlreadyExistsError extends Error {
  name = 'MediaAlreadyExistsError'

  constructor(public filepath: string, public checksum: string) {
    super(`file '${filepath}' checksum ${checksum} already exists`)
  }
}

export class SubprocessError extends Error {
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

export class UnExpectedError extends Error {
  name = 'UnExpectedError'
}
