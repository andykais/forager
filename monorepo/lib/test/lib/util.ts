import * as asserts from 'https://deno.land/std@0.155.0/testing/asserts.ts'
export { expectType as expect_type } from "npm:ts-expect"
import * as colors from 'jsr:@std/fmt@0.225.4/colors'
import * as path from '@std/path'
import { Debugger } from './debugger.ts'
import { Forager } from '../../../packages/core/src/mod.ts'

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
  'Succulentsaur.mp4',
  'cityscape-timelapse.mp4',
  'cat_cronch.mp4',
] as const)

if (!import.meta.dirname) throw new Error(`unexpected value in import.meta.dirname`)
const resources = {
  resources_directory: path.join(path.resolve(import.meta.dirname, '..'), 'resources'),
  media_files,
  books_db_1_0_0: 'test/resources/migrations_1.0.0.db',
}


type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
type ForagerMediaSearchResult = ReturnType<Forager['media']['search']>
type SearchResultAssertions = DeepPartial<ReturnType<Forager['media']['search']>>

class Assertions {
  equals = asserts.assertEquals
  not_equals = asserts.assertNotEquals
  rejects = asserts.assertRejects
  throws = asserts.assertThrows
  object_match = asserts.assertObjectMatch
  list_includes = asserts.assertArrayIncludes
  search_result(search_result: ForagerMediaSearchResult, assertions: SearchResultAssertions) {
    if (assertions.total) {
      this.equals(search_result.total, assertions.total)
    }
    if ('cursor' in assertions) {
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
  list_partial<T extends object>(actual_list: T[], expected_list: Partial<T>[], sort_fn?: (a: T, b: T) => number) {
    this.equals(actual_list.length, expected_list.length, `Expected list length to be ${actual_list.length} but is actually ${expected_list.length}`)
    const expected_list_keys = expected_list.map(item => Object.keys(item))
    for (const expected_keys of expected_list_keys) this.equals(expected_keys, expected_list_keys[0], 'list_partial must supply the same keys for each element')
    const expected_keys = expected_list_keys[0]
    let massaged_actual_list = actual_list.map(item => {
      const partial_entries = Object.entries(item).filter(entry => expected_keys.includes(entry[0]))
      return Object.fromEntries(partial_entries)
    })
    if (sort_fn) massaged_actual_list = massaged_actual_list.sort(sort_fn as any)
    this.equals(massaged_actual_list as any, expected_list as any)
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

interface TestOptions {
  only?: boolean
  skip?: { os: typeof Deno.build.os }
}

function test(test_name: string, fn: (test_context: TestContext) => void, options?: TestOptions) {

  const test_fn = async (t: Deno.TestContext) => {
      const test_context = new TestContext(test_name, t)
    // setup
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })
    await Deno.remove(test_context.fixture_folder, { recursive: true })
    await Deno.mkdir(test_context.fixture_folder, { recursive: true })

    const result = await fn(test_context)
    return result
  }

  const deno_test_options: Deno.TestDefinition = {
    name: test_name,
    fn: test_fn,
  }
  if (options?.skip?.os === Deno.build.os) {
    deno_test_options.ignore = true
  }
  if (options?.only) {
    deno_test_options.only = true
  }
  Deno.test(deno_test_options)
}
test.only = (name: string, fn: (test_context: TestContext) => void, options?: TestOptions) => { test(name, fn, {...options, only: true}) }

export { test }