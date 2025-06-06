import { onMount } from 'svelte'
import type { Config } from '$lib/server/config.ts'


type KeybindAction =
  | 'Escape'
  | 'Search'
  | 'PrevMedia'
  | 'NextMedia'
  | 'PrevTagSuggestion'
  | 'NextTagSuggestion'
  | 'PlayPauseMedia'
  | 'ToggleMediaControls'

type KeybindActionListener = (e: KeyboardEvent) => void

export class Keybinds {
  public emitter: EventTarget
  public disabled: boolean
  #keybind_mapper: Map<string, KeybindAction> | undefined
  #config: Config | undefined

  public constructor(config: Config) {
    this.emitter = new EventTarget()
    this.disabled = false
    this.#config = config

    const keyboard_actions_entries = Object.entries(this.#config.web.shortcuts).map(entry => {
      const keyboard_action: KeybindAction = entry[0] as KeybindAction
      const keyboard_shortcut = entry[1]

      return [keyboard_shortcut, keyboard_action] as [string, KeybindAction]
    })

    this.#keybind_mapper = new Map<string, KeybindAction>(keyboard_actions_entries)
  }

  public component_listen(handlers: Partial<Record<KeybindAction, KeybindActionListener>>) {
    onMount(() => {
      for (const [keybind_event, handler] of Object.entries(handlers)) {
        this.listen(keybind_event, handler)
      }

      return () => {
        for (const [keybind_event, handler] of Object.entries(handlers)) {
          this.remove_listener(keybind_event, handler)
        }
      }
    })
  }

  public listen(event: KeybindAction, handler: KeybindActionListener) {
    this.emitter.addEventListener(event, handler)
    return handler
  }

  public remove_listener(event: KeybindAction, handler: KeybindActionListener) {
    this.emitter.removeEventListener(event, handler)
  }

  public handler = (e: KeyboardEvent) => {
    if (this.disabled) return
    if (!this.#keybind_mapper) return

    const last_keycode = e.code
      .replace('Shift', '')
      .replace('Shift', '')
      .replace('Control', '')
      .replace('Alt', '')
      .replace('Key', '')

    const keys_down: string[] = []
    if (e.ctrlKey) keys_down.push('Ctrl')
    if (e.shiftKey) keys_down.push('Shift')
    if (e.altKey) keys_down.push('Alt')
    keys_down.push(last_keycode)
    const code = keys_down.join('-')

    const action = this.#keybind_mapper.get(code)
    if (action) {
      this.emitter.dispatchEvent(new CustomEvent(action, {
        detail: {
          data: { keyboard_event: e }
        }
      }))
    }
  }

  public disable() {
    this.disabled = true
  }

  public enable() {
    this.disabled = false
  }
}
