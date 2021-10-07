import 'source-map-support/register'
import test from 'ava'
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


test.beforeEach(async () => {
  await rmf(NEW_DB_PATH)
  await rmf(OUTDATED_DB_PATH)
})
// TODO we should add data to these migrations. Its going to suck to reimplement file import, but its gonna be hella useful
test('migrations', async t => {
  try {
    const forager_new = new Forager({ database_path: NEW_DB_PATH })
    forager_new.init()
    const context_new = ((forager_new as any).context as Forager['context']) // context is a private prop, were being a bit cheeky here
    const table_schemas_new = context_new.db.table_manager.tables_schema()
    await forager_new.media.create(MEDIA_FILEPATH, {}, [])

    const outdated_forager = new Forager({ database_path: OUTDATED_DB_PATH })
    const outdated_context = ((outdated_forager as any).context as Forager['context']) // context is a private prop, were being a bit cheeky here
    outdated_context.db.migration_map.get('0.0.0')!.call() // run the very first migration, which sets up tables in the very first version
    outdated_context.db.table_manager.set_forager_metadata('0.0.0')
    await create_media(outdated_context.db.db, MEDIA_FILEPATH)
    outdated_forager.init()
    const table_schemas_migrated = outdated_context.db.table_manager.tables_schema()

    t.deepEqual(table_schemas_new, table_schemas_migrated)
  } catch(e){
    console.error({message: e.message})
    throw e
  }
})
