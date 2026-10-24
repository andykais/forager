import { type Forager, errors, parsers } from '@forager/core'
import type { McpConfigOutput } from './config.ts'


/**
 * Enforces the `mcp.tags.allowed` config. Only tags being added (via a create, add, or replace) are checked, removing tags is always allowed.
 */
class TagPolicy {
  #allowed: McpConfigOutput['tags']['allowed']
  #allowed_slugs = new Set<string>()
  #allowed_groups = new Set<string>()

  constructor(private forager: Forager, allowed: McpConfigOutput['tags']['allowed']) {
    this.#allowed = allowed
    if (Array.isArray(allowed)) {
      for (const tag_shorthand of allowed) {
        const tag = parsers.Tag.parse(tag_shorthand)
        if (tag.name === '*') this.#allowed_groups.add(tag.group)
        else this.#allowed_slugs.add(tag.slug)
      }
    }
  }

  /** Throws a BadInputError listing every tag that is not allowed */
  enforce(tags: string[]) {
    if (this.#allowed === 'any') return

    const disallowed = tags
      .map(tag_shorthand => parsers.Tag.parse(tag_shorthand))
      .filter(tag => !this.#is_allowed(tag))
      .map(tag => tag.slug)

    if (disallowed.length) {
      const reason = this.#allowed === 'existing'
        ? 'only tags that already exist in the database can be added'
        : `allowed tags are ${JSON.stringify(this.#allowed)}`
      throw new errors.BadInputError(`Tags ${JSON.stringify(disallowed)} are not allowed, ${reason}`)
    }
  }

  #is_allowed(tag: {slug: string; group: string}) {
    if (this.#allowed === 'existing') {
      try {
        this.forager.tag.get({slug: tag.slug})
        return true
      } catch (e) {
        if (e instanceof errors.NotFoundError) return false
        throw e
      }
    }
    return this.#allowed_slugs.has(tag.slug) || this.#allowed_groups.has(tag.group)
  }
}


export { TagPolicy }
