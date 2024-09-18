import * as yaml from '@std/yaml'
import z from 'zod'
import * as forager from '@forager/core'


const LogLevel = z.enum(['SILENT', 'ERROR', 'WARN', 'INFO', 'DEBUG'])

export const PackagesConfig = z.object({
  core: forager.parsers.ForagerConfig,

  web: z.object({
    port: z.number().default(8000),
    asset_folder: z.string(),
    log_level: LogLevel.default('INFO'),
  })
})

export type Config = z.infer<typeof PackagesConfig>


export async function load_config(config_filepath: string) {
  const file_contents_string = await Deno.readTextFile(config_filepath)
  const file_contents = yaml.parse(file_contents_string)
  return PackagesConfig.parse(file_contents)
}
