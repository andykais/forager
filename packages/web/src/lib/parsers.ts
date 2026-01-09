import type { Forager } from '@forager/core'
type TagModel = Awaited<ReturnType<Forager['tag']['search']>>['results'][0]

class Tag {
  static encode(tag: TagModel) {
    if (tag.group) {
      return `${tag.group}:${tag.name}`
    } else {
      return tag.name
    }
  }

  static decode(tag_str: string): {name: string, group?: string} {
    const colon_index = tag_str.indexOf(':')
    if (colon_index === -1) {
      return { name: tag_str }
    } else {
      return {
        group: tag_str.substring(0, colon_index),
        name: tag_str.substring(colon_index + 1)
      }
    }
  }
}

export { Tag }
