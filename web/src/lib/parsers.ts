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

  static decode(tag_str: string) {
    throw new Error('unimplemented')
  }
}

export { Tag }
