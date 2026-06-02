// `@forager/server/config` owns the config schema as of Phase 3 of the
// Tauri port. This shim keeps the historical `@forager/web/config` export
// path working for downstream consumers.
export {
  PackagesConfig,
  load_config,
  type Config,
} from '@forager/server/config'
