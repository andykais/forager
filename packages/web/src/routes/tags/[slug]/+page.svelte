<script lang="ts">
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import Header from '$lib/components/Header.svelte'
  import Tag from '$lib/components/Tag.svelte'
  import Datetime from '$lib/components/Datetime.svelte'
  import Icon from '$lib/components/Icon.svelte'
  import { XCircle } from '$lib/icons/mod.ts'
  import TagAutoCompleteInput from '$lib/components/TagAutoCompleteInput.svelte'
  import { TagDetailController } from './controller.svelte.ts'

  let props = $props()
  const controller = new TagDetailController(props.data.config)

  let alias_input = $state('')
  let child_input = $state('')
  let parent_input = $state('')

  onMount(() => {
    const slug = decodeURIComponent(page.params.slug)
    controller.load(slug)
  })
</script>

<div class="h-dvh flex flex-col">
  <Header title={controller.detail?.tag.slug ?? 'Tag Detail'}>
    <div class="flex items-center gap-3 p-3 w-full">
      {#if controller.detail}
        <Tag tag={controller.detail.tag} />
      {/if}
      <a href="/tags" class="text-sm text-slate-400 hover:text-slate-200 ml-auto shrink-0">Back to Tags</a>
    </div>
  </Header>

  <div class="flex-grow overflow-y-auto p-6">
    {#if controller.loading && !controller.detail}
      <p class="text-slate-400">Loading...</p>
    {:else if controller.error}
      <p class="text-red-400">{controller.error}</p>
    {:else if controller.detail}
      <div class="max-w-3xl mx-auto flex flex-col gap-8">

        <!-- Section 1: Tag Info -->
        <section>
          <h2 class="text-slate-300 text-lg font-semibold mb-3 border-b border-slate-600 pb-1">Tag Info</h2>
          <form class="flex flex-col gap-3" onsubmit={async e => {
            e.preventDefault()
            await controller.save()
          }}>
            <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-center">
              <label class="text-slate-400 text-sm" for="tag-name">Name</label>
              <input
                id="tag-name"
                class="rounded-md py-1 px-3 text-slate-100 bg-gray-800 text-sm"
                type="text"
                bind:value={controller.draft.name}
              />
              <label class="text-slate-400 text-sm" for="tag-group">Group</label>
              <input
                id="tag-group"
                class="rounded-md py-1 px-3 text-slate-100 bg-gray-800 text-sm"
                type="text"
                bind:value={controller.draft.group}
              />
              <label class="text-slate-400 text-sm self-start pt-1" for="tag-description">Description</label>
              <textarea
                id="tag-description"
                class="rounded-md py-1 px-3 text-slate-100 bg-gray-800 text-sm min-h-16"
                bind:value={controller.draft.description}
              ></textarea>
              <label class="text-slate-400 text-sm">Created</label>
              <Datetime value={controller.detail.tag.created_at} class="text-slate-300 text-sm" />
            </div>
            <div class="flex gap-3 items-center">
              <button
                type="submit"
                class="rounded-md px-4 py-1 bg-green-800 text-green-100 hover:bg-green-700 text-sm"
              >Save</button>
              <a
                href="/browse?tags={controller.detail.tag.slug}"
                class="text-sm text-slate-400 hover:text-slate-200"
              >Browse media with this tag</a>
            </div>
          </form>
        </section>

        <!-- Section 2: Aliases -->
        <section>
          <h2 class="text-slate-300 text-lg font-semibold mb-3 border-b border-slate-600 pb-1">Aliases</h2>

          {#if controller.detail.alias_for}
            <div class="mb-3 p-2 rounded-md bg-gray-700">
              <span class="text-slate-400 text-sm">This tag is an alias for:</span>
              <div class="flex items-center gap-2 mt-1">
                <a href="/tags/{controller.detail.alias_for.slug}" class="hover:underline">
                  <Tag tag={controller.detail.alias_for} />
                </a>
                <button
                  class="hover:cursor-pointer shrink-0"
                  title="Remove alias"
                  onclick={() => controller.alias_delete(controller.detail!.alias_for!.rule_id)}
                >
                  <Icon class="fill-red-400 hover:fill-red-300" data={XCircle} size="18px" color="none" />
                </button>
              </div>
            </div>
          {/if}

          {#if controller.detail.aliases.length > 0}
            <div class="mb-3">
              <span class="text-slate-400 text-sm">Tags aliased to this one:</span>
              <div class="flex flex-col gap-1 mt-1">
                {#each controller.detail.aliases as alias (alias.id)}
                  <div class="flex items-center gap-2">
                    <a href="/tags/{alias.slug}" class="hover:underline flex-grow">
                      <Tag tag={alias} />
                    </a>
                    <button
                      class="hover:cursor-pointer shrink-0"
                      title="Remove alias"
                      onclick={() => controller.alias_delete(alias.rule_id)}
                    >
                      <Icon class="fill-red-400 hover:fill-red-300" data={XCircle} size="18px" color="none" />
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <form class="flex gap-2 items-end" onsubmit={async e => {
            e.preventDefault()
            if (alias_input.trim()) {
              await controller.alias_create(alias_input.trim())
              alias_input = ''
            }
          }}>
            <div class="flex-grow">
              <label class="text-slate-400 text-xs">Set a tag as alias for this one</label>
              <TagAutoCompleteInput
                {controller}
                bind:search_string={alias_input}
                kind="details"
                placeholder="tag to alias..."
                input_classes="w-full rounded-md py-1 px-3 text-slate-100 bg-gray-800 text-sm"
              />
            </div>
            <button
              type="submit"
              class="rounded-md px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm shrink-0"
            >Add Alias</button>
          </form>
        </section>

        <!-- Section 3: Parent/Child Relationships -->
        <section>
          <h2 class="text-slate-300 text-lg font-semibold mb-3 border-b border-slate-600 pb-1">Parent / Child Tags</h2>

          <!-- Children -->
          <div class="mb-4">
            <h3 class="text-slate-400 text-sm font-medium mb-2">Children (included when this tag is applied)</h3>
            {#if controller.detail.children.length > 0}
              <div class="flex flex-col gap-1 mb-2">
                {#each controller.detail.children as child (child.id)}
                  <div class="flex items-center gap-2">
                    <a href="/tags/{child.slug}" class="hover:underline flex-grow">
                      <Tag tag={child} />
                    </a>
                    <button
                      class="hover:cursor-pointer shrink-0"
                      title="Remove child"
                      onclick={() => controller.parent_delete(child.rule_id)}
                    >
                      <Icon class="fill-red-400 hover:fill-red-300" data={XCircle} size="18px" color="none" />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-slate-500 text-sm mb-2">No child tags.</p>
            {/if}
            <form class="flex gap-2 items-end" onsubmit={async e => {
              e.preventDefault()
              if (child_input.trim()) {
                await controller.child_create(child_input.trim())
                child_input = ''
              }
            }}>
              <div class="flex-grow">
                <TagAutoCompleteInput
                  {controller}
                  bind:search_string={child_input}
                  kind="details"
                  placeholder="add child tag..."
                  input_classes="w-full rounded-md py-1 px-3 text-slate-100 bg-gray-800 text-sm"
                />
              </div>
              <button
                type="submit"
                class="rounded-md px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm shrink-0"
              >Add Child</button>
            </form>
          </div>

          <!-- Parents -->
          <div>
            <h3 class="text-slate-400 text-sm font-medium mb-2">Parents (this tag is included when a parent is applied)</h3>
            {#if controller.detail.parents.length > 0}
              <div class="flex flex-col gap-1 mb-2">
                {#each controller.detail.parents as parent (parent.id)}
                  <div class="flex items-center gap-2">
                    <a href="/tags/{parent.slug}" class="hover:underline flex-grow">
                      <Tag tag={parent} />
                    </a>
                    <button
                      class="hover:cursor-pointer shrink-0"
                      title="Remove parent"
                      onclick={() => controller.parent_delete(parent.rule_id)}
                    >
                      <Icon class="fill-red-400 hover:fill-red-300" data={XCircle} size="18px" color="none" />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-slate-500 text-sm mb-2">No parent tags.</p>
            {/if}
            <form class="flex gap-2 items-end" onsubmit={async e => {
              e.preventDefault()
              if (parent_input.trim()) {
                await controller.parent_add(parent_input.trim())
                parent_input = ''
              }
            }}>
              <div class="flex-grow">
                <TagAutoCompleteInput
                  {controller}
                  bind:search_string={parent_input}
                  kind="details"
                  placeholder="add parent tag..."
                  input_classes="w-full rounded-md py-1 px-3 text-slate-100 bg-gray-800 text-sm"
                />
              </div>
              <button
                type="submit"
                class="rounded-md px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm shrink-0"
              >Add Parent</button>
            </form>
          </div>
        </section>

      </div>
    {/if}
  </div>
</div>
