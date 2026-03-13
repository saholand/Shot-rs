CREATE TABLE IF NOT EXISTS uploads (
  id           TEXT PRIMARY KEY,
  storage_key  TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  file_type    TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  delete_token TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expires ON uploads(expires_at);
