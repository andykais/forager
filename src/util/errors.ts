class NotFoundError extends Error {
  constructor(model: string, query: any) {
    super(`${model} "${query}" does not exist`)
  }
}

export { NotFoundError }
