import type { Config } from '$lib/server/config.ts'
import type { Forager } from '@forager/core'
import { BaseController } from '$lib/base_controller.ts'
import { create_focuser, SettingsRune } from '$lib/runes/index.ts'
import { goto } from '$app/navigation'


type TagDetail = Awaited<ReturnType<Forager['tag']['get']>>

class TagDetailController extends BaseController {
  runes: {
    focus: ReturnType<typeof create_focuser>
    settings: SettingsRune
  }

  handlers = {}

  detail: TagDetail | null = $state(null)
  loading: boolean = $state(false)
  error: string | null = $state(null)

  draft = $state({
    name: '',
    group: '',
    description: '',
  })

  public constructor(config: Config) {
    super(config)

    this.runes = {
      focus: create_focuser(),
      settings: new SettingsRune(this.client, this.config),
    }
  }

  async load(slug: string) {
    this.loading = true
    this.error = null
    try {
      this.detail = await this.client.forager.tag.get({ slug })
      this.draft = {
        name: this.detail.tag.name,
        group: this.detail.tag.group,
        description: this.detail.tag.description ?? '',
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    } finally {
      this.loading = false
    }
  }

  async save() {
    if (!this.detail) return
    const old_slug = this.detail.tag.slug
    await this.client.forager.tag.update({
      slug: old_slug,
      name: this.draft.name,
      group: this.draft.group,
      description: this.draft.description || undefined,
    })
    const new_slug = this.draft.group
      ? `${this.draft.group}:${this.draft.name}`
      : this.draft.name
    if (new_slug !== old_slug) {
      goto(`/tags/${new_slug}`)
    }
    await this.load(new_slug)
  }

  async alias_create(alias_tag_str: string) {
    if (!this.detail) return
    await this.client.forager.tag.alias_create({
      alias_tag: alias_tag_str,
      alias_for_tag: this.detail.tag.slug,
    })
    await this.load(this.detail.tag.slug)
  }

  async alias_delete(rule_id: number) {
    if (!this.detail) return
    await this.client.forager.tag.alias_delete({ id: rule_id })
    await this.load(this.detail.tag.slug)
  }

  async child_create(child_tag_str: string) {
    if (!this.detail) return
    await this.client.forager.tag.parent_create({
      child_tag: child_tag_str,
      parent_tag: this.detail.tag.slug,
    })
    await this.load(this.detail.tag.slug)
  }

  async parent_add(parent_tag_str: string) {
    if (!this.detail) return
    await this.client.forager.tag.parent_create({
      child_tag: this.detail.tag.slug,
      parent_tag: parent_tag_str,
    })
    await this.load(this.detail.tag.slug)
  }

  async parent_delete(rule_id: number) {
    if (!this.detail) return
    await this.client.forager.tag.parent_delete({ id: rule_id })
    await this.load(this.detail.tag.slug)
  }
}

export { TagDetailController }
