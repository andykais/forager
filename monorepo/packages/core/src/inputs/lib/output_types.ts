import * as z from 'zod'
import * as parsers from './inputs_parsers.ts'


export type MediaReferenceUpdateTags = z.infer<typeof parsers.MediaReferenceUpdateTags>
export type ForagerConfig = z.infer<typeof parsers.ForagerConfig>
