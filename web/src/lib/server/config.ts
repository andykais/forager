import * as yaml from '@std/yaml'
import z from 'zod'
import * as forager from '@forager/core'


const LogLevel: z.ZodEnum<["SILENT", "ERROR", "WARN", "INFO", "DEBUG"]>  = z.enum(['SILENT', 'ERROR', 'WARN', 'INFO', 'DEBUG'])

const Keybind = (default_keybind: string): z.ZodDefault<z.ZodString> => z.string().default(default_keybind)

export const PackagesConfig = z.object({
  core: forager.parsers.ForagerConfig,

  web: z.object({

    // TODO reuse core editing config parser
    editing: z.object({
      editor: z.string(),
      overwrite: z.boolean().default(true),
    }).strict().optional(),

    port: z.number().default(8000),
    asset_folder: z.string(),

    logger: z.object({
      level: LogLevel.default('INFO'),
    }).strict().default({}),

    ui_defaults: z.object({

      search: z.object({
        advanced_filters: z.object({
          hide: z.boolean().default(true)
        }).strict().default({})
      }).strict().default({}),

      media_list: z.object({
        thumbnail_size: z.number().default(110),
        thumbnail_shape: z.enum(['square', 'original']).default('original') as z.ZodEnum<['square', 'original']>
      }).strict().default({}),

      sidebar: z.object({
        hide: z.boolean().default(true),
        size: z.number().default(200),
        tags: z.object({
          order: z.object({
            group: z.string(),
          }).array().default([])
        }).strict().default({}),
      }).strict().default({}),

      media_view: z.object({
        filmstrip: z.object({
          enabled: z.boolean().default(false),
            thumbnail_size: z.number().default(100),
        }).strict().optional().transform(f => f ?? {enabled: false})
      }).strict().default({}),
    }).strict().default({}),

    shortcuts: z.object({
      OpenMedia: Keybind('Enter'),
      Escape: Keybind('Escape'),

      NextMedia: Keybind('ArrowRight'),
      PrevMedia: Keybind('ArrowLeft'),

      NextTagSuggestion: Keybind('ArrowDown'),
      PrevTagSuggestion: Keybind('ArrowUp'),

      CopyMedia: Keybind('Ctrl-C'),

      // DownMedia: Keybind('ArrowDown'),
      // UpMedia: Keybind('ArrowUp'),
      ToggleFitMedia: Keybind('Ctrl-Space'),
      ToggleFullScreen: Keybind('KeyF'),
      PlayPauseMedia: Keybind('Space'),
      ToggleVideoMute: Keybind('KeyM'),
      ToggleMediaControls: Keybind('Ctrl-C'),

      Search: Keybind('Slash'),
      AddTag: Keybind('Ctrl-M'),

      // ToggleVideoPreviewVsThumbails: Keybind('KeyT'),

      // Star0: Keybind('Digit0'),
      // Star1: Keybind('Digit1'),
      // Star2: Keybind('Digit2'),
      // Star3: Keybind('Digit3'),
      // Star4: Keybind('Digit4'),
      // Star5: Keybind('Digit5'),
    }).default(() => ({})),
  })
}).strict()

export type Config = z.infer<typeof PackagesConfig>


export async function load_config(config_filepath: string): Promise<Config> {
  const file_contents_string = await Deno.readTextFile(config_filepath)
  const file_contents = yaml.parse(file_contents_string)
  return PackagesConfig.parse(file_contents)
}
