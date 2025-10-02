import {forager, query} from '$lib/api/backend.ts'

export const search = query(forager.media.search)
export const group = query(forager.media.group)
export const update = query(forager.media.update)
export const get = query(forager.media.get)
export const create = query(forager.media.create)
export const upsert =  query(forager.media.upsert)
// export delete = query(forager.media.delete) // NOTE we cannot name functions delete :(
