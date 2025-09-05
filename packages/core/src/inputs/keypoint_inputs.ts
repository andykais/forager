import z from 'zod'
import {Timestamp} from '~/lib/inputs_base.ts'
import {MediaReferenceId} from './media_reference_inputs.ts'
import {Tag} from './tag_inputs.ts'

export const KeypointCreate = z.object({
  media_reference_id: MediaReferenceId,
  tag: Tag,
  start_timestamp: Timestamp,
  end_timestamp: Timestamp.optional(),
})
