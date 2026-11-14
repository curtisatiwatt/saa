-- Bind this D1 database as DB. Store ciphertext only: never tokens, keys, or plaintext.
CREATE TABLE IF NOT EXISTS progress (
  id TEXT PRIMARY KEY NOT NULL
    CHECK(length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*'),
  payload TEXT NOT NULL CHECK(json_valid(payload) AND length(payload) <= 1500000),
  revision INTEGER NOT NULL CHECK(revision >= 1),
  updated_at TEXT NOT NULL,
  request_window INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count >= 0)
) WITHOUT ROWID;

-- Hour-specific SHA-256 IP pseudonyms; stale windows are pruned on valid creates.
CREATE TABLE IF NOT EXISTS create_limits (
  ip_hash TEXT PRIMARY KEY NOT NULL
    CHECK(length(ip_hash) = 64 AND ip_hash NOT GLOB '*[^0-9a-f]*'),
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 6)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS create_limits_window ON create_limits(window_start);
