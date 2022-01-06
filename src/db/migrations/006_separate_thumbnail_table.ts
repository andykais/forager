import { promisify } from 'util'
import os from 'os'
import fs from 'fs'
import path from 'path'
import child_process from 'child_process'
import { createHash } from 'crypto'
import { MigrationStatement } from '../base'

const exec = promisify(child_process.exec)

const TIMESTAMP_SQLITE = `STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')`
const TIMESTAMP_COLUMN = `TIMESTAMP DATETIME DEFAULT(${TIMESTAMP_SQLITE})`

interface OldFileInfo {
  duration: number
  media_type: 'VIDEO' | 'IMAGE' | 'AUDIO'
  width?: number
  height?: number
}

const num_captured_frames = 18
const max_width = 500
const max_height = 500
async function  get_thumbnails(filepath: string, file_info: OldFileInfo) {
  const full_width = file_info.width!
  const full_height = file_info.height!

  const max_width_or_height = full_width > full_height
    ? `${500}x${Math.floor((full_height*500)/full_width)}`
    : `${Math.floor((full_width*500)/full_height)}x${500}`

  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'thumbnails-'))
  const thumbnail_filepath = path.join(tmpdir, 'thumbnail-%04d.jpg')

  let thumbnail_timestamps = [0]
  let framerate = 0
  try {
    if (file_info.media_type === 'VIDEO') {
      const { stdout } = await exec(`ffprobe -v error -print_format json -show_streams -i '${filepath}'`)
      const ffprobe_data = JSON.parse(stdout)
      const video_stream = ffprobe_data.streams.find((s: any) => s.codec_type === 'video')
      if (!video_stream) throw new Error(`Could not find video stream for '${filepath}'`)
      framerate = eval(video_stream.avg_frame_rate)
      if (Number.isNaN(framerate)) throw new Error(`Unable to parse framerate for ${filepath} from ${video_stream.avg_frame_rate}`)
      const thumbnail_fps = 1 / (file_info.duration / num_captured_frames)

      const ffmpeg_cmd = `ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -vf fps=${thumbnail_fps} -frames:v ${num_captured_frames} -f image2 '${thumbnail_filepath}'`
      const ffprobe_cmd = `ffprobe -v error -f lavfi -i "movie=${filepath},fps=fps=${thumbnail_fps}[out0]" -show_frames -show_entries frame=pkt_pts_time -of csv=p=0`
      const [frame_timestamps] = await Promise.all([
        exec(ffprobe_cmd).then(out => {
          const timestamps = out.stdout.trim().split('\n').map(line => parseFloat(line))
          for (const timestamp of timestamps) if (Number.isNaN(timestamp)) throw new Error(`could not parse ffprobe timestamp for thumbnail of ${filepath}, ${out.stderr}`)
          return timestamps
        }),
        exec(ffmpeg_cmd),
      ])
      thumbnail_timestamps = frame_timestamps
    } else if (file_info.media_type  === 'IMAGE') {
      const cmd = `ffmpeg -v error -i '${filepath}' -an -s ${max_width_or_height} -frames:v 1 -ss ${0} '${thumbnail_filepath}'`
      await exec(cmd)
    } else if (file_info.media_type === 'AUDIO') {
      throw new Error('audio thumbnail unimplemented')
    }
    const thumbnail_filepaths = await fs.promises.readdir(tmpdir)
    if (thumbnail_filepaths.length !== thumbnail_timestamps.length) throw new Error(`ffprobe thumbnail timestamp detection for ${filepath} incorrect`)
    const thumbnails = await Promise.all(thumbnail_filepaths.map(async (filepath, i) => {
      const buffer = await fs.promises.readFile(path.join(tmpdir, filepath))
      return {
        timestamp: thumbnail_timestamps[i],
        thumbnail: buffer,
        file_size_bytes: buffer.length,
        sha512checksum: get_buffer_checksum(buffer),
      }
    }))
    await fs.promises.rm(tmpdir, { recursive: true })
    return { thumbnails, framerate }
  } catch (e) {
    console.error(e)
    throw new Error(`A fatal error has occurred creating thumbnails for '${filepath}`)
  }
}

function get_buffer_checksum(buffer: Buffer): string {
  const hash = createHash('sha512')
  const data = hash.update(buffer)
  return data.digest('hex')
}


export class Migration extends MigrationStatement {
  static VERSION = '0.5.0' as const

  static FOREIGN_KEYS = false

  async call() {
    this.db.exec(`
      CREATE TABLE media_file_new (
        id INTEGER PRIMARY KEY NOT NULL,
        filename TEXT NOT NULL,
        -- mime_type TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        sha512checksum TEXT NOT NULL UNIQUE,

        -- image,video,audio
        media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO') ),
        codec TEXT NOT NULL,
        content_type TEXT NOT NULL,
        -- image/video
        width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND width  IS NOT NULL),
        height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND height IS NOT NULL),
        -- audio/video/gif specific
        animated BOOLEAN NOT NULL,
        framerate INTEGER NOT NULL CHECK (IIF(animated == 0, framerate == 0, 1)),
        duration INTEGER NOT NULL CHECK (IIF(animated == 0, duration == 0, 1)),

        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        media_reference_id INTEGER NOT NULL,
        FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
      );

      CREATE TABLE media_thumbnail (
        id INTEGER PRIMARY KEY NOT NULL,
        thumbnail BLOB NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        sha512checksum TEXT NOT NULL,
        timestamp FLOAT NOT NULL,
        thumbnail_index INTEGER NOT NULL,
        updated_at ${TIMESTAMP_COLUMN},
        created_at ${TIMESTAMP_COLUMN},

        media_file_id INTEGER NOT NULL,
        FOREIGN KEY (media_file_id) REFERENCES media_reference(id)
      );
    `)

    this.db.exec(`
      INSERT INTO media_file_new (
        id,
        filename,
        file_size_bytes,
        sha512checksum,
        media_type,
        codec,
        content_type,
        width,
        height,
        animated,
        framerate,
        duration,
        updated_at,
        created_at,
        media_reference_id
      ) SELECT
        id,
        filename,
        file_size_bytes,
        sha512checksum,
        media_type,
        codec,
        content_type,
        width,
        height,
        animated,
        0 as framerate,
        duration,
        updated_at,
        created_at,
        media_reference_id
      FROM media_file
    `)

    this.db.exec(`
      DROP TABLE media_file;
      ALTER TABLE media_file_new RENAME TO media_file;
      -- we have to re-add indexes for dropped tables
      CREATE UNIQUE INDEX media_file_reference ON media_file (media_reference_id);
      CREATE INDEX media_file_type ON media_file (media_type, animated);

    `)

    const select_media_file_ids_stmt = this.db.prepare(`SELECT id, codec,  media_type, duration, width, height FROM media_file`)
    const select_media_chunks_stmt = this.db.prepare(`SELECT chunk FROM media_chunk WHERE media_file_id = ?`)
    const update_media_file_stmt = this.db.prepare(`UPDATE media_file SET framerate = :framerate WHERE id = :media_file_id`)
    const insert_media_thumbnail_stmt = this.db.prepare(`INSERT INTO media_thumbnail (
      thumbnail,
      file_size_bytes,
      sha512checksum,
      timestamp,
      thumbnail_index,
      media_file_id
    ) VALUES (@thumbnail, @file_size_bytes, @sha512checksum, @timestamp, @thumbnail_index, @media_file_id)`)

    interface MediaFile {
      id: number
      codec: string
      media_type: 'VIDEO'|'IMAGE'|'AUDIO'
      duration: number
      width?: number
      height?: number
    }
    for (const media_file of select_media_file_ids_stmt.all() as MediaFile[]) {
      const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), '006_migration-'))
      const ext = {
        'h264': 'mp4',
        'tiff': 'tif',
        'png': 'png',
        'mjpeg': 'jpg',
        'aac': 'aac',
      }[media_file.codec]
      if (ext === undefined) throw new Error(`unexpected codec type ${media_file.codec}`)

      const media_filepath = path.join(tmpdir, `media.${ext}`)
      const stream = fs.createWriteStream(media_filepath, {'flags': 'a'});
      await new Promise((resolve, reject) => {
        stream.once('open', function(fd) {
          for (const { chunk } of select_media_chunks_stmt.iterate(media_file.id)) {
            stream.write(chunk)
          }
          stream.close()
        })
        stream.once('error', reject)
        stream.once('close', resolve)
      })
      const { thumbnails, framerate } = await get_thumbnails(media_filepath, media_file)
      for (const thumbnail_index of thumbnails.keys()) {
        insert_media_thumbnail_stmt.run({
          ...thumbnails[thumbnail_index],
          thumbnail_index,
          media_file_id: media_file.id,
        })
      }
      update_media_file_stmt.run({ framerate, media_file_id: media_file.id })
    }
  }
}
