import * as fs from 'fs'
import { Context } from '../../src/context'
import { Forager } from '../../src/index'
import {  create_media } from './emulate_0_0_0_media_create'

const NEW_DB_PATH = 'test/fixtures/migration-latest.db'
const OUTDATED_DB_PATH = 'test/fixtures/migration-outdated.db'
const MEDIA_FILEPATH = 'test/resources/cityscape-timelapse.mp4'

async function rmf(filepath: string) {
  try {
    await fs.promises.unlink(filepath)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
}


beforeEach(async () => {
  await rmf(NEW_DB_PATH)
  await rmf(NEW_DB_PATH + '-shm')
  await rmf(NEW_DB_PATH + '-wal')
  await rmf(OUTDATED_DB_PATH)
  await rmf(OUTDATED_DB_PATH + '-shm')
  await rmf(OUTDATED_DB_PATH + '-wal')
})

test('migrations', async function() {
  const sample_tag = { group: '', name: 'sample' }
  const forager_new = new Forager({ database_path: NEW_DB_PATH, log_level: 'info' })
  await forager_new.init()
  const context_new = ((forager_new as any).context as Forager['context']) // context is a private prop, were being a bit cheeky here
  const table_schemas_new = context_new.db.table_manager.tables_schema()
  await forager_new.media.create(MEDIA_FILEPATH, {}, [sample_tag])

  const outdated_forager = new Forager({ database_path: OUTDATED_DB_PATH, log_level: 'info' })
  const outdated_context = ((outdated_forager as any).context as Forager['context']) // context is a private prop, were being a bit cheeky here
  outdated_context.db.migrations.find(m => m.version === '0.0.0')!.migration.call() // run the very first migration, which sets up tables in the very first version
  outdated_context.db.table_manager.set_forager_metadata('0.0.0')
  const video_media = await create_media(outdated_context.db.db, MEDIA_FILEPATH, {}, [sample_tag])
  await outdated_forager.init()
  const table_schemas_migrated = outdated_context.db.table_manager.tables_schema()

  expect(table_schemas_new).toEqual(table_schemas_migrated)

  const range = { bytes_start: 10485760, bytes_end: 11065971 }
  expect(
    forager_new.media.get_file(1, range)).toEqual(
    outdated_forager.media.get_file(1, range)
  )
  expect(forager_new.tag.list()[0].unread_media_reference_count).toEqual(1)
  expect(outdated_forager.tag.list()[0].unread_media_reference_count).toEqual(1)
  expect(outdated_forager.media.get_media_info(video_media.media_file_id).framerate).toEqual(24)
})
