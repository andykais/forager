import * as cli from '@std/cli'
import {Forager, type ForagerConfig} from '@forager/core'
import * as fs from '@std/fs'
import * as path from '@std/path'
import * as yaml from '@std/yaml'
import z from 'zod'

interface ForagerHelpersOptions {
  config?: string
  logLevel: 'debug' | 'info' | 'error' | 'json'
  quiet?: boolean
}

class ForagerHelpers {
  public config_filepath: string
  constructor(public config: ForagerHelpersOptions) {
    this.config_filepath = config.config ?? this.#get_config_filepath() 
  }

  async ensure_config() {
    if (await fs.exists(this.config_filepath)) {
      return
    }

    const answer = prompt(`forager has not been set up at ${this.config_filepath}. Create a config now? (Y/n)`)
    const answer_safe = z.enum(['n', 'Y', 'y', '']).parse(answer)
    if (answer_safe === 'n') {
      console.log('Aborting.')
      Deno.exit(0)
    }

    // everything else means go

    const config_dir = path.dirname(this.config_filepath)
    await Deno.mkdir(config_dir, {recursive: true})
    const default_config: ForagerConfig = {
      database_path: path.join(config_dir, 'forager.db'),
      // TODO add prompt options for each of these
      thumbnail_folder: path.join(config_dir, 'thumbnails'),

      log_level: 'info',
    }

    // // default_config.database_path =  prompt(`# Hit Enter or set a custom database path.\ndatabase_filepath: "${default_config.database_path}"`) ?? default_config.database_path
    // default_config.database_path =  this.#cli_prompt_answer({
    //   help: '# The location of the application sqlite database.',
    //   config_key: 'database_path',
    //   default_value: default_config.database_path,
    // })

    await Deno.writeTextFile(this.config_filepath, yaml.stringify(default_config))
  }

  print_output(json: any) {
    if (this.#should_print_json()) {
      console.log(json)
    }
  }

  #should_print_json() {
    return this.config.logLevel === 'json' || this.config.quiet
  }

  async #read_config() {
    const file_contents = await Deno.readTextFile(this.config_filepath)
    const config = yaml.parse(file_contents) as ForagerConfig
    if (this.#should_print_json()) {
      config.log_level = 'error'
    }
    return config
  }

  async launch_forager() {
    await this.ensure_config()
    const forager_config = await this.#read_config()
    const forager = new Forager(forager_config as ForagerConfig)
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
    } else {
      throw new Error('unimplemented')
    }
  }
}

export { ForagerHelpers }
