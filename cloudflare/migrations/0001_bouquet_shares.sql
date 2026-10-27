CREATE TABLE bouquets (
  code TEXT PRIMARY KEY NOT NULL CHECK(length(code) = 16),
  digest TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length > 0),
  created_at INTEGER NOT NULL
);
CREATE TABLE share_rate_limits (
  ip_hash TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count > 0)
);
CREATE INDEX share_rate_window ON share_rate_limits(window_start);
