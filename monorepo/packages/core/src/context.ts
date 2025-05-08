import { outputs } from '~/inputs/mod.ts'
import { Logger } from '~/lib/logger.ts'
import { Database } from '~/db/mod.ts'
import { PluginScript } from "~/lib/plugin_script.ts";
import type { Forager } from '~/mod.ts'


class Context {
  public config: outputs.ForagerConfig
  public logger: Logger
  public db: Database
  public plugin_script: PluginScript
  public forager: Forager


  public constructor(config: outputs.ForagerConfig, plugin_script: PluginScript, forager: Forager) {
    this.config = config
    this.forager = forager
    this.logger = new Logger('forager.core', this.config.logger.level)
    this.db = new Database(this)
    this.plugin_script = plugin_script
  }

  public init() {
    this.logger.info(`Connecting to sqlite database ${this.config.database_path}`)
    this.db.init()
  }
}

export { Context }
