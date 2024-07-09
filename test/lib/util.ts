import * as asserts from 'https://deno.land/std@0.155.0/testing/asserts.ts'
export { expectType as expect_type } from "npm:ts-expect"
import * as colors from 'jsr:@std/fmt@0.225.4/colors'
import * as path from '@std/path'
import { Forager } from '~/mod.ts'
import { Debugger } from './debugger.ts'

type ValueOf<T> = T extends Array<infer V>
  ? V
  : never
type ResourceFileMapper<T extends string[]> = {
  [K in ValueOf<T>]: string
}
// TODO error out early here if the resource file does not exist (maybe with fs.existsSync?)
function resource_file_mapper<F extends string[]>(resource_files: F): ResourceFileMapper<F> {
  const resource_entries = resource_files.map(relative_path => {
    if (!import.meta.dirname) throw new Error(`unexpected value in import.meta.dirname`)
    const resource_filepaths = path.join(path.resolve(import.meta.dirname, '..'), 'resources', relative_path)
    return [relative_path, resource_filepaths]
  })
  return Object.fromEntries(resource_entries)
}
const media_files = resource_file_mapper([
  'koch.tif',
  'ed-edd-eddy.png',
  'cat_doodle.jpg',
  // 'Succulentsaur.mp4',
  // 'cityscape-timelapse.mp4',
] as const)

const resources = {
  media_files,
  books_db_1_0_0: 'test/resources/migrations_1.0.0.db',
}


type ForagerMediaSearchResult = ReturnType<Forager['media']['search']>
interface SearchResultAssertions {
  total?: number
  cursor?: number | undefined
  result?: {
    media_reference?: Partial<ForagerMediaSearchResult['result'][0]['media_reference']>
    media_file?: Partial<ForagerMediaSearchResult['result'][0]['media_file']>
  }[]
}

class Assertions {
  equals = asserts.assertEquals
  rejects = asserts.assertRejects
  throws = asserts.assertThrows
  object_match = asserts.assertObjectMatch
  search_result(search_result: ForagerMediaSearchResult, assertions: SearchResultAssertions) {
    if (assertions.total) {
      this.equals(search_result.total, assertions.total)
    }
    if (assertions.cursor) {
      this.equals(search_result.cursor, assertions.cursor)
    }

    if (assertions.result) {
      this.equals(search_result.result.length, assertions.result.length, `Expected search result length to be ${assertions.result.length} but is actually ${search_result.result.length}`)
      this.object_match({
        result: search_result.result
      }, {
        result: assertions.result
      })
    }
  }
  list_partial(actual_list: any[], expected_list: any[]) {
    this.equals(actual_list.length, expected_list.length, `Expected list length to be ${actual_list.length} but is actually ${expected_list.length}`)
    const actual_list_sorted = [...actual_list].sort((a, b) => a - b)
    const expected_list_sorted = [...actual_list].sort((a, b) => a - b)
    this.object_match(actual_list_sorted as any, expected_list_sorted as any)
  }
}

class TestContext {
  test_name: string
  resources = resources
  assert = new Assertions()
  #deno_test_ctx: Deno.TestContext

  constructor(test_name: string, deno_test_ctx: Deno.TestContext) {
    this.test_name = test_name
    this.#deno_test_ctx = deno_test_ctx
  }

  subtest(subtest_name: string, subtest_fn: () => Promise<void> | void): Promise<boolean> {
    return this.#deno_test_ctx.step(subtest_name, subtest_fn)
  }

  get fixture_folder() {
    return path.join('test', 'fixtures', this.test_name)
  }
  create_fixture_path(filepath: string) {
    return path.join(this.fixture_folder, filepath)
  }

  async remove(path: string) {
    await Deno.remove(path, { recursive: true })
  }
}

// NOTE this overrides everyone's console.debug with detailed logging
Debugger.attach_console_debug()

function test(test_name: string, fn: (test_context: TestContext) => void, only = false) {

  const test_fn = async (t: Deno.TestContext) => {
      const test_context = new TestContext(test_name, t)
    // setup
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })
    await Deno.remove(test_context.fixture_folder, { recursive: true })
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })

    const result = await fn(test_context)
    return result
  }
  Deno.test({
    name: test_name,
    fn: test_fn,
    only
  })
}
test.only = (name: string, fn: (test_context: TestContext) => void) => { test(name, fn, true) }

export { test }
