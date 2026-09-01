interface TagEncodable {
  group?: string | null
  name: string
}

class Tag {
  static encode(tag: TagEncodable) {
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
