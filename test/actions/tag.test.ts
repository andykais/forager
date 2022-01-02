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

test('tag crud', async () => {
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
  expect(before_tags.map(t => t.name).sort(str_compare)).toEqual(['black', 'procedural_generation'])

  // we can re-add tags that already exist on the media reference and errors should be silent
  const after_tags = forager.tag.add_tags(media_reference_id, [{ group: 'colors', name: 'black' }, { group: '', name: 'art' }])
  expect(after_tags.map(t => t.name).sort(str_compare)).toEqual(['art', 'black', 'procedural_generation'])

  const after_delete_tags = forager.tag.remove_tags(media_reference_id, [{ group: 'colors', name: 'black' }])
  expect(after_delete_tags.map(t => t.name).sort(str_compare)).toEqual(['art', 'procedural_generation'])

  const final_tags = forager.tag.get_tags(media_reference_id)
  expect(final_tags.map(t => t.name).sort(str_compare)).toEqual(['art', 'procedural_generation'])

  const all_tags = forager.tag.list()
  all_tags.sort((a, b) => str_compare(a.name, b.name))
  expect(all_tags.map(t => ({ name: t.name, media_reference_count: t.media_reference_count }))).toEqual([
    { name: 'art', media_reference_count: 1},
    { name: 'black', media_reference_count: 0},
    { name: 'procedural_generation', media_reference_count: 1},
  ])

  // search tags
  expect(forager.tag.search({ name: 'pr' }).length).toEqual(1)
  expect(forager.tag.search({ name: 'pr' })[0]).toEqual(expect.objectContaining({ group: '', name: 'procedural_generation' }))
  // not passing in group will search on any groups
  expect(forager.tag.search({ name: 'blac' }).length).toEqual(1)
  expect(forager.tag.search({ name: 'blac' })[0]).toEqual(expect.objectContaining({ group: 'colors', name: 'black' }))
  // passing in a group only searches on that group (theres 'black' tag, but its under the 'colors' group)
  expect(forager.tag.search({ group: '', name: 'blac' }).length).toEqual(0)
  // filtering tags out should remove them
  expect(forager.tag.search({ name: 'blac', filter: [{name: 'black', group:'colors'}] }).length).toEqual(0)
  expect(forager.tag.search({ name: 'proc', filter: [{name: 'black', group:'colors'}] }).length).toEqual(1)
  expect(forager.tag.search({ name: 'proc' })[0]).toEqual(expect.objectContaining({name: 'procedural_generation'}))
  }catch(e){
    console.error(e)
    throw e
  }
})
