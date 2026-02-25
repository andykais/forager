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

  constructor(public filepath: string, public checksum: string, public existing_media_filepath: string, public media_reference_id: number) {
    super(`file '${filepath}' checksum ${checksum} is a duplicate of ${existing_media_filepath}`)
  }
}

export abstract class AlreadyExistsError extends ForagerError {
  abstract get identifier(): string
  constructor(public media_reference_id: number, message: string) {
    super(message)
  }
}

export class SeriesAlreadyExistsError extends AlreadyExistsError {
  override name = 'SeriesAlreadyExistsError'

  override get identifier() {
    return `series '${this.media_series_name}'`
  }

  constructor(public media_series_name: string, media_reference_id: number) {
    super(media_reference_id, `series '${media_series_name}' already exists`)
  }
}

export class SeriesItemAlreadyExistsError extends AlreadyExistsError {
  override name = 'SeriesItemAlreadyExistsError'

  override get identifier() {
    return `series '${this.media_series_name}'`
  }

  constructor(public media_series_name: string, media_series_index: number, media_reference_id: number) {
    super(media_reference_id, `series '${media_series_name}' item #${media_series_index} already exists`)
  }
}

export class MediaAlreadyExistsError extends AlreadyExistsError {
  override name = 'MediaAlreadyExistsError'

  // TODO clean up these helpers
  override get identifier() {
    return `file '${this.filepath} checksum ${this.checksum}'`
  }

  constructor(public filepath: string, public checksum: string, media_reference_id: number) {
    super(media_reference_id, `file '${filepath}' checksum ${checksum} already exists`)
  }
}

export class ChecksumMismatchError extends ForagerError {
  override name = 'ChecksumMismatchError'

  constructor(public filepath: string, public expected_checksum: string, public actual_checksum: string) {
    super(`file '${filepath}' checksum changed: expected ${expected_checksum} but found ${actual_checksum}`)
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

  constructor(message: string, cause?: Error) {
    super(message, {cause})
  }
}


export class FileNotFound extends FileProcessingError {
  override name = 'FileNotFound'
}

export class InvalidFileError extends FileProcessingError {
  override name = 'InvalidFileError'
}
