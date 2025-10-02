import {forager, query} from '$lib/api/backend.ts'

export const start = query(forager.views.start)
export const update = query(forager.views.update)
