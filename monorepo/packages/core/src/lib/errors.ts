export class ForagerError extends Error {}


/**
  * Raised when an action recevies invalid data, similar to a "400" api status code.
  */
export class BadInputError extends ForagerError {
  override name = 'BadInputError'
}

/**
  * Raised when a resource (media reference, tag, series) is not found, similar to a "404" api status code.
  */
export class NotFoundError extends ForagerError {
  override name = 'NotFoundError'

  constructor(model: string, query_name: string, params: any) {
    super(`${model} "${JSON.stringify(params)}" does not exist (queried with ${query_name})`)
  }
}

export class DuplicateMediaError extends ForagerError {
  override name = 'DuplicateMediaError'

  constructor(public filepath: string, public checksum: string, public existing_media_filepath: string) {
    super(`file '${filepath}' checksum ${checksum} is a duplicate of ${existing_media_filepath}`)
  }
}

export class MediaAlreadyExistsError extends ForagerError {
  override name = 'MediaAlreadyExistsError'

  constructor(public filepath: string, public checksum: string) {
    super(`file '${filepath}' checksum ${checksum} already exists`)
  }
}

export class SubprocessError extends ForagerError {
  override name = 'SubprocessError'
  public output: Deno.CommandOutput
  public constructor(output: Deno.CommandOutput, message: string) {
    const decoder = new TextDecoder()
    const stdout = decoder.decode(output.stdout)
    const stderr = decoder.decode(output.stderr)
    super(`${message}\n\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`)
    this.output = output
  }
}

export class UnExpectedError extends ForagerError {
  override name = 'UnExpectedError'
}

export class FileProcessingError extends ForagerError {
  override name = 'FileProcessingError'

  constructor(message: string, cause: Error) {
    super(message, {cause})
  }
}

export class InvalidFileError extends FileProcessingError {
  override name = 'InvalidFileError'
}
