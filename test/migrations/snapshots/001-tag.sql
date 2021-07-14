CREATE TABLE media_chunks (
  id INTEGER PRIMARY KEY NOT NULL,
  media_file_id INTEGER NOT NULL,
  -- 1MiB chunks
  chunk BLOB NOT NULL,

  FOREIGN KEY (media_file_id) REFERENCES media_file(id)
);


CREATE TABLE media_file (
  id INTEGER PRIMARY KEY NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  md5checksum TEXT NOT NULL,

  -- image,video,audio
  media_type TEXT NOT NULL CHECK( media_type IN ('IMAGE', 'VIDEO', 'AUDIO') ),
  -- image/video
  width  INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND width  IS NOT NULL),
  height INTEGER CHECK (media_type IN ('IMAGE', 'VIDEO') AND height IS NOT NULL),
  -- audio/video/gif specific
  animated BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (IIF(animated == 0, duration_ms == 0, 1)),

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  media_reference_id INTEGER NOT NULL,
  FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
);

CREATE TABLE media_sequence (
  id INTEGER PRIMARY KEY NOT NULL,
  media_reference_id INTEGER NOT NULL,
  FOREIGN KEY (media_reference_id) REFERENCES media_reference(id)
);


-- Polymorphic table referenced by either media files or media sequences
-- NOTE we do not enforce that a media_reference is only referenced by either media_sequence or media_file
CREATE TABLE media_reference (
  id INTEGER PRIMARY KEY NOT NULL,

  media_sequence_id INTEGER,
  media_sequence_index INTEGER NOT NULL DEFAULT 0,

  source_url TEXT,
  source_created_at DATETIME,
  title TEXT,
  description TEXT,
  metadata JSON,

  -- TODO should we use a separate table for thumbnails?
  thumbnail BLOB NOT NULL,
  thumbnail_file_size_bytes INTEGER NOT NULL,
  thumbnail_md5checksum TEXT NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (media_sequence_id) REFERENCES media_sequence(id)
);


CREATE TABLE media_reference_tag (
  media_reference_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,

  PRIMARY KEY (media_reference_id, tag_id),
  FOREIGN KEY (media_reference_id) REFERENCES media_reference(id),
  FOREIGN KEY (tag_id) REFERENCES tag(id)
);


-- TODO `tag` text searches are slow, try creating a full text search virtual table
/* CREATE VIRTUAL TABLE tag USING FTS5(name); */
CREATE TABLE tag (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  tag_group_id INTEGER NOT NULL,
  -- some tags will just be aliases for others. We have to be careful not to have cyclical references here
  alias_tag_id INTEGER,

  FOREIGN KEY (alias_tag_id) REFERENCES tag(id),
  FOREIGN KEY (tag_group_id) REFERENCES tag_group(id)
);


CREATE TABLE tag_group (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE forager (
  singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK (singleton = 1),
  version FLOAT NOT NULL,
  name TEXT NOT NULL
);


-- NOTES: lets use the "INDEXED BY <index_name>" clause to hardcode indexes to look things up with
-- It will be cool and way easier to determine what queries are used

CREATE UNIQUE INDEX media_tag ON media_reference_tag (tag_id, media_reference_id);
CREATE UNIQUE INDEX tag_name ON tag (name, tag_group_id);
CREATE UNIQUE INDEX media_file_reference ON media_file (media_reference_id);
CREATE INDEX media_file_type ON media_file (media_type, animated);
