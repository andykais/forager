import * as cli from '@std/cli'
import * as forager from '@forager/core'
import * as fs from '@std/fs'
import * as path from '@std/path'
import z from 'zod'

interface ForagerHelpersOptions {
  config?: string
}

class ForagerHelpers {
  constructor(public config: ForagerHelpersOptions) {}

  async ensure_config() {
    const config_filepath = this.config.config ?? this.#get_config_filepath() 
    console.log({config_filepath})
    if (await fs.exists(config_filepath)) {
      console.log('fs exists?')
      return
    }

    console.log('prompting...')
    const answer = await prompt(`forager has not been set up at ${config_filepath}. Create a config now? (Y/n)`)
    const answer_safe = z.enum(['n', 'Y', 'y', '']).parse(answer)
    if (answer === 'n') {
      console.log('Aborting.')
      Deno.exit(0)
    }

    // everything else means go

    const config_dir = path.dirname(config_filepath)
    await Deno.mkdir(config_dir, {recursive: true})
    const default_config: forager.ForagerConfig = {
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

    await Deno.writeTextFile(config_filepath, JSON.stringify(default_config))
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
      console.log({homedir})
      const config_dir = path.join(homedir, '.config')
      return config_dir
    } else {
      throw new Error('unimplemented')
    }
  }
}

export { ForagerHelpers }
