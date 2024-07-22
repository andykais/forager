import z from 'zod'
import {Timestamp, Duration} from '~/lib/inputs_base.ts'
import {MediaReferenceId} from './media_reference_inputs.ts'


const ViewId = z.number()


export const ViewCreate = z.object({
  media_reference_id: MediaReferenceId,
  start_timestamp: Timestamp.optional(),
})


export const ViewUpdate = z.object({
  view_id: ViewId,
  view_duration: Duration,

  // animated only fields
  start_timestamp: Timestamp.optional(),
  end_timestamp: Timestamp.optional(),
  num_loops: z.number().optional(),
})
