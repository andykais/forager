import 'source-map-support/register'
import test from 'ava'
import * as fs from 'fs'
import { Context } from '../../src/context'

const NEW_DB_PATH = 'scratchwork/latest.db'
const OUTDATED_DB_PATH = 'scratchwork/outdated.db'

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
test('migrations', async t => {
  try {
    const fresh_context = new Context({ database_path: NEW_DB_PATH })
    fresh_context.init()
    const new_defs = fresh_context.db.table_manager.tables_schema()
    // console.log(new_defs)
    t.pass()

    const outdated_context = new Context({ database_path: OUTDATED_DB_PATH })
    const first_migration = 
    outdated_context.db.migration_map.get('0.0.0')!.call()
    outdated_context.db.table_manager.set_forager_metadata('0.0.0')
    outdated_context.init()
    const outdated_defs = outdated_context.db.table_manager.tables_schema()

    t.deepEqual(new_defs, outdated_defs)

  } catch(e){
    console.error({message: e.message})
    throw e
  }
})
