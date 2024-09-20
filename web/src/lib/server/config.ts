import * as yaml from '@std/yaml'
import z from 'zod'
import * as forager from '@forager/core'


const LogLevel: z.ZodEnum<["SILENT", "ERROR", "WARN", "INFO", "DEBUG"]>  = z.enum(['SILENT', 'ERROR', 'WARN', 'INFO', 'DEBUG'])

const Keybind = (default_keybind: string): z.ZodDefault<z.ZodString> => z.string().default(default_keybind)

export const PackagesConfig = z.object({
  core: forager.parsers.ForagerConfig,

  web: z.object({
    port: z.number().default(8000),
    asset_folder: z.string(),
    log_level: LogLevel.default('INFO'),

    shortcuts: z.object({
      OpenMedia: Keybind('Enter'),
      Escape: Keybind('Escape'),

      NextMedia: Keybind('ArrowRight'),
      PrevMedia: Keybind('ArrowLeft'),
      // DownMedia: Keybind('ArrowDown'),
      // UpMedia: Keybind('ArrowUp'),
      ToggleFitMedia: Keybind('Ctrl-Space'),
      ToggleFullScreen: Keybind('KeyF'),
      PlayPauseMedia: Keybind('Space'),
      ToggleVideoMute: Keybind('KeyM'),

      Search: Keybind('Slash'),
      AddTag: Keybind('Ctrl-KeyM'),

      // ToggleVideoPreviewVsThumbails: Keybind('KeyT'),

      // Star0: Keybind('Digit0'),
      // Star1: Keybind('Digit1'),
      // Star2: Keybind('Digit2'),
      // Star3: Keybind('Digit3'),
      // Star4: Keybind('Digit4'),
      // Star5: Keybind('Digit5'),
    }).default(() => ({})),
  })
})

export type Config = z.infer<typeof PackagesConfig>


export async function load_config(config_filepath: string): Promise<Config> {
  const file_contents_string = await Deno.readTextFile(config_filepath)
  const file_contents = yaml.parse(file_contents_string)
  return PackagesConfig.parse(file_contents)
}
