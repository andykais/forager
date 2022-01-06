import fs from 'fs'
import arg from 'arg'
import { Forager, DuplicateMediaError } from './index'
import { Logger } from './logger'
import type { LogLevel } from './logger'

const args = arg({
  '--help': Boolean,
  // context flags
  '--database': String,
  '--log-level': String,
  // media create flags
  '--tag': [String],
  '--title': String,
  // aliases
  '-t': '--tag',
  '--db': '--database',
})

if (args['--help']) {
  console.log(`forager [...<media file>]

OPTIONS:
  --database, --db    Path to database.
  --log-level         Forager log level (debug, info, warn, error).
  --title             Title of media file(s) imported.
  --tag, -t           Tags attached to media file(s) imported (e.g. "genre:action").
                      Can be specified more than once.
  --help              Print this help message.
`)
  process.exit(0)
}

if (!args['--database']) {
  console.error('--database MUST be provided')
  process.exit(1)
}
const database_path = args['--database']
const log_level = (args['--log-level'] as LogLevel) ?? 'info'
const config = { database_path, log_level }
const cli_logger = new Logger(log_level)

function parse_tags(tags: string[] = []) {
  return tags.map((tag) => {
    const parsed = tag.split(':')
    if (parsed.length === 1) return { group: '', name: parsed[0] }
    else if (parsed.length === 2) return { group: parsed[0], name: parsed[1] }
    else throw new Error(`Invalid tag ${tag}`)
  })
}

;(async () => {
  const forager = new Forager(config)
  forager.init()
  for (const filepath of args['_']) {
    const stats = await fs.promises.stat(filepath)
    const media_info = {  source_created_at: stats.ctime }
    const tags = parse_tags(args['--tag'])
    try {
      cli_logger.info(`importing ${filepath}`)
      await forager.media.create(filepath, media_info, tags)
    } catch(e) {
      // TODO combine tags of duplicate files (e.g. dont put tag creates inside transaction)
      if (e instanceof DuplicateMediaError) cli_logger.warn(`file ${filepath} already exists.`)
      else throw e
    }
  }
})()
