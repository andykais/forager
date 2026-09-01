// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Forager } from '@forager/core'
import type { Config } from '$lib/server/config.ts'

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			forager: Forager
			config: Config
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
