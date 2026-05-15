// `@forager/server` owns the config schema as of Phase 1 of the Tauri port.
// This file remains as a re-export so all the `$lib/server/config.ts`
// imports throughout the frontend keep working with no changes.
export {
  PackagesConfig,
  load_config,
  type Config,
} from '@forager/server/config'
