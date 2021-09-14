import test from 'ava'
import * as fs from 'fs'
import { Forager } from '../../src/index'

async function rmf(filepath: string) {
  try {
    await fs.promises.unlink(filepath)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
}

function str_compare(a: string, b: string) {
  return a.localeCompare(b)
}

test('tag crud', async t => {
  try{
  const database_path = 'test/fixtures/forager.db'
  const media_output_path = 'test/fixtures/koch-export.tif'
  await fs.promises.mkdir('test/fixtures', { recursive: true })
  await rmf(database_path)
  await rmf(media_output_path)

  const forager = new Forager({ database_path })
  forager.init()

  // import a file
  const tags = [{ group: '', name: 'Procedural Generation' }, { group: 'colors', name: 'black' }]
  const media_info = { title: 'Generated Art', stars: 2 }
  const { media_reference_id, media_file_id } = await forager.media.create('test/resources/koch.tif', media_info, tags)

  const before_tags = forager.tag.get_tags(media_reference_id)
  t.deepEqual(before_tags.map(t => t.name).sort(str_compare), ['black', 'procedural_generation'])

  // we can re-add tags that already exist on the media reference and errors should be silent
  const after_tags = forager.tag.add_tags(media_reference_id, [{ group: 'colors', name: 'black' }, { group: '', name: 'art' }])
  t.deepEqual(after_tags.map(t => t.name).sort(str_compare), ['art', 'black', 'procedural_generation'])

  const after_delete_tags = forager.tag.remove_tags(media_reference_id, [{ group: 'colors', name: 'black' }])
  t.deepEqual(after_delete_tags.map(t => t.name).sort(str_compare), ['art', 'procedural_generation'])

  const final_tags = forager.tag.get_tags(media_reference_id)
  t.deepEqual(final_tags.map(t => t.name).sort(str_compare), ['art', 'procedural_generation'])

  const all_tags = forager.tag.list()
  all_tags.sort((a, b) => str_compare(a.name, b.name))
  t.deepEqual(all_tags.map(t => ({ name: t.name, media_reference_count: t.media_reference_count })), [
    { name: 'art', media_reference_count: 1},
    { name: 'black', media_reference_count: 0},
    { name: 'procedural_generation', media_reference_count: 1},
  ])

  // search tags
  t.is(forager.tag.search({ name: 'pr' }).length, 1)
  forager.tag.search({ name: 'pr' }).map(tag => t.like(tag, {group: '', name: 'procedural_generation'}))
  // not passing in group will search on any groups
  t.is(forager.tag.search({ name: 'blac' }).length, 1)
  forager.tag.search({ name: 'blac' }).map(tag => t.like(tag, {group: 'colors', name: 'black'}))
  // passing in a group only searches on that group (theres 'black' tag, but its under the 'colors' group)
  t.is(forager.tag.search({ group: '', name: 'blac' }).length, 0)

  }catch(e){
    console.error(e)
    throw e
  }
})
