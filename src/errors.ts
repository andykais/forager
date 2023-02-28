class NotFoundError extends Error {
  constructor(model: string, query: any) {
    super(`${model} "${JSON.stringify(query)}" does not exist`)
  }
}

class DuplicateMediaError extends Error {
  constructor(filepath: string, checksum: string, options?: ErrorOptions) {
    super(`file '${filepath}' checksum ${checksum} already exists`, options)
  }
}

class MediaParseError extends Error {
  constructor(filepath: string, message: string) {
    super(`file '${filepath}' ${message}`)
  }
}

export { NotFoundError, DuplicateMediaError, MediaParseError }
