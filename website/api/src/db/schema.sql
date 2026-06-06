-- SysAdmin Game Registry API schema (SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  leaderboard_opt_in INTEGER NOT NULL DEFAULT 0,
  profile_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_auth_sessions (
  device_code TEXT PRIMARY KEY,
  user_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  user_id TEXT REFERENCES users(id),
  client_label TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS labs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  runtime TEXT NOT NULL DEFAULT 'docker',
  badges TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  creator_id TEXT REFERENCES users(id),
  creator_name TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  suspicious_activity INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_versions (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  pack_filename TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  signature TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  runtime_requirements TEXT NOT NULL DEFAULT '{}',
  published_at TEXT NOT NULL,
  UNIQUE(lab_id, version)
);

CREATE TABLE IF NOT EXISTS lab_reviews (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(lab_id, user_id)
);

CREATE TABLE IF NOT EXISTS lab_reports (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_downloads (
  id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES lab_versions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  device_id TEXT,
  downloaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profile_remote (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  total_completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id TEXT NOT NULL,
  lab_version TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  best_time_sec INTEGER,
  hints_used INTEGER NOT NULL DEFAULT 0,
  validation_passed INTEGER NOT NULL DEFAULT 0,
  verified_completion INTEGER NOT NULL DEFAULT 0,
  completion_proof TEXT,
  device_id TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, lab_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id TEXT,
  display_name TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  completed_labs INTEGER NOT NULL DEFAULT 0,
  best_time_sec INTEGER,
  hints_used INTEGER NOT NULL DEFAULT 0,
  verified_only INTEGER NOT NULL DEFAULT 1,
  hidden INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, lab_id)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_lab_updates INTEGER NOT NULL DEFAULT 1,
  email_new_verified_labs INTEGER NOT NULL DEFAULT 1,
  email_lab_completions INTEGER NOT NULL DEFAULT 1,
  email_lab_deployment_ready INTEGER NOT NULL DEFAULT 1,
  email_leaderboard_milestones INTEGER NOT NULL DEFAULT 1,
  email_security_alerts INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_labs_category ON labs(category);
CREATE INDEX IF NOT EXISTS idx_labs_difficulty ON labs(difficulty);
CREATE INDEX IF NOT EXISTS idx_lab_versions_lab ON lab_versions(lab_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_xp ON leaderboard_entries(xp DESC);

CREATE TABLE IF NOT EXISTS email_rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  device_id TEXT,
  ip TEXT,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_id TEXT,
  event TEXT NOT NULL,
  ip TEXT,
  rate_limited INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_action_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_rate_user_event ON email_rate_limits(user_id, event, sent_at);
CREATE INDEX IF NOT EXISTS idx_email_action_token_hash ON email_action_tokens(token_hash);
