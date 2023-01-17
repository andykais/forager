import { z, expect_type } from './deps.ts'
import { type LogLevel } from './logger.ts'

interface ForagerConfig {
  database_path: string

  log_level?: LogLevel
}

const ForagerConfigInput = z.object({
  database_path: z.string(),
  log_level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
}).strict()


// this is a typescript exacty type assertion. It does nothing at runtime
// it ensures that our zod validator and our typescript spec stay in sync
expect_type<ForagerConfig>({} as z.input<typeof ForagerConfigInput>)


export { ForagerConfigInput }
export type { ForagerConfig }
