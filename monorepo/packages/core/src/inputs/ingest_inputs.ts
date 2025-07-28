import z from 'zod'
import { PaginatedQuery } from '~/lib/inputs_base.ts'
import { FileSystemQuery } from './filesystem_inputs.ts'
import { MediaInfo } from './media_reference_inputs.ts'
import { TagList } from "./tag_inputs.ts";
import { Tag } from './tag_inputs.ts'


export const IngestStart = z.object({
  query: FileSystemQuery.optional(),

  set: z.object({
    media_info: MediaInfo.optional(),
    tags: Tag.array().optional(),
  }).optional(),
}).strict().default({})


export const IngestStop = z.object({
}).strict().optional()


export const IngestStatus = z.object({
}).strict().optional()


export const IngestSearch = PaginatedQuery.extend({
  query: FileSystemQuery,
}).strict().optional()


export const IngestUpdate = z.object({
  update: z.object({
    tags: TagList,
    metadata: MediaInfo,
  }).strict(),
  query: FileSystemQuery,
}).strict()
