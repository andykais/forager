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

export { NotFoundError, DuplicateMediaError }
