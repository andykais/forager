import { Action } from './base'
import * as inputs from '../inputs'
import { get_hash_color } from '../util/text_processing'

class TagAction extends Action {
  public list() {
    return this.db.tag.select_all()
  }

  public search(tag: inputs.TagSearch) {
    const query = inputs.TagSearchInput.parse(tag)
    return this.db.tag.select_many_like_name({ ...query, limit: 10 })
  }

  public get_tags(media_reference_id: number) {
    return this.db.tag.select_many_by_media_reference({ media_reference_id })
  }

  public add_tags(media_reference_id: number, tags: inputs.TagList) {
    const tags_input = inputs.TagListInput.parse(tags)
    const transaction = this.db.db.transaction(() => {
      for (const tag of tags_input) {
        const group = tag.group ?? ''
        const color = get_hash_color(group, 'hsl')
        const tag_group_id = this.db.tag_group.create({ name: group, color })
        const tag_id = this.db.tag.create({ alias_tag_id: null, name: tag.name, tag_group_id })
        try {
          this.db.media_reference_tag.insert({ media_reference_id, tag_id })
        } catch(e) {
          if(this.is_unique_constaint_error(e)) {}
          else throw e
        }
      }
    })
    transaction()
    return this.db.tag.select_many_by_media_reference({ media_reference_id })
  }

  public remove_tags(media_reference_id: number, tags: inputs.TagList) {
    const tags_input = inputs.TagListInput.parse(tags)
    const transaction = this.db.db.transaction(() => {
      for (const tag of tags_input) {
        const tag_row = this.db.tag.select_one_by_name(tag)
        if (!tag_row) throw new Error(`Tag ${tag.group}:${tag.name} not found`)
        const tag_id = tag_row.id
        // TODO for now we arent deleting orphaned tags or tag_groups. I think a trigger would work fine though
        // especially since we already track counts
        this.db.media_reference_tag.delete({ media_reference_id, tag_id })
      }
    })
    transaction()
    return this.db.tag.select_many_by_media_reference({ media_reference_id })
  }

}

export { TagAction }
