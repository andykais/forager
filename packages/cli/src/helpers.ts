import z from 'zod'
import { Forager, type outputs } from '@forager/core'
import { Config } from './inputs.ts'
import * as fs from '@std/fs'
import * as path from '@std/path'
import * as yaml from '@std/yaml'


type LogLevel = 'SILENT' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'


interface ForagerHelpersOptions {
  config?: string
  prompt?: boolean
  json?: boolean
  logLevel?: LogLevel | undefined
  quiet?: boolean
}

class ForagerHelpers {
  public config_filepath: string
  #config: z.infer<typeof Config> | undefined
  #log_level: LogLevel
  #prompt_user: boolean

  constructor(public options: ForagerHelpersOptions) {
    this.config_filepath = options.config ?? this.#get_config_filepath() 
    this.#log_level = options.logLevel ?? 'INFO'
    this.#prompt_user = options.prompt ?? true
  }

  async ensure_config() {
    if (await fs.exists(this.config_filepath)) {
      await this.#read_config()
      return
    }

    if (this.#prompt_user) {
      const answer = prompt(`forager has not been set up at ${this.config_filepath}. Create a config now? (Y/n)`)
      const answer_safe = z.enum(['n', 'Y', 'y', '']).parse(answer)

      if (answer_safe === 'n') {
        console.log('Aborting.')
        Deno.exit(0)
      }
    } else {
      console.log(`forager has not been set up at ${this.config_filepath}. Creating a config now.`)
    }
    // everything else means go

    // ensure we are dealing with absolute paths
    const config_dir = path.resolve(path.dirname(this.config_filepath))
    await Deno.mkdir(config_dir, {recursive: true})
    const default_config = Config.parse({
      core: {
        database: {
          folder: path.join(config_dir, 'database'),
          filename: 'forager.db',
          migrations: {
            automatic: true
          },
          backups: true,
        },
        // TODO add prompt options for each of these
        thumbnails: {
          folder: path.join(config_dir, 'thumbnails'),
          preview_duration_threshold: 0.2,
          size: 512,
        },

        tags: {
          auto_cleanup: true,
        },

        logger: {
          level: this.#log_level,
        }
      },
      web: {
        port: 8000,
        asset_folder: path.join(config_dir, 'static_assets'),
        logger: {
          level: this.#log_level,
        }
      }
    })

    await Deno.writeTextFile(this.config_filepath, yaml.stringify(default_config))
    console.log(`Wrote ${path.resolve(this.config_filepath)}`)
    await this.#read_config()
  }

  print_output(output: any) {
    if (this.#should_print_json()) {
      console.log(JSON.stringify(output))
    } else {
      console.log(output)
    }
  }

  #should_print_json() {
    return this.options.json
  }

  get config() {
    if (this.#config) return this.#config
    else throw new Error('config not yet initialized')
  }

  async #read_config() {
    const file_contents = await Deno.readTextFile(this.config_filepath)
    const raw_config = yaml.parse(file_contents)
    const config = Config.parse(raw_config)
    if (this.#should_print_json()) {
      config.core.logger.level = 'SILENT'
    }
    this.#config = config
    if (this.options.logLevel) {
      this.#config.core.logger.level = this.#log_level
      this.#config.web.logger.level = this.#log_level
    }
  }

  async launch_forager() {
    await this.ensure_config()
    const forager = new Forager(this.config.core)
    forager.init()
    return forager
  }

  #cli_prompt_answer(params: {
    help: string;
    config_key: string;
    default_value: any;
  }) {
    const {help, config_key,default_value} = params
    const answer = prompt(`${help}\n${config_key}: "${default_value}" [Enter or input value]`)

    return answer ?? default_value
  }

  #get_config_filepath() {
    const config_dir = this.#get_config_dir()
    return path.join(config_dir, 'forager', 'forager.yml')
  }
  #get_config_dir() {
    if (Deno.build.os === 'linux') {
      // const standard_config_dir = Deno.env.get('XDG_CONFIG_<i forget>')
      const homedir = z.string().parse(Deno.env.get('HOME'))
      const config_dir = path.join(homedir, '.config')
      return config_dir
    } else if (Deno.build.os === 'darwin') {
      const homedir = z.string().parse(Deno.env.get('HOME'))
      const config_dir = path.join(homedir, '.config')
      return config_dir
    } else {
      throw new Error('unimplemented')
    }
  }
}

export { ForagerHelpers }
