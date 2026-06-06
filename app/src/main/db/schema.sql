-- Computer Server Labs — local progress database (MPL-2.0)
-- Stored under app.getPath('userData')/progress.db

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  total_completed INTEGER NOT NULL DEFAULT 0,
  validation_passes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_progress (
  lab_id TEXT PRIMARY KEY,
  completed INTEGER NOT NULL DEFAULT 0,
  best_time_sec INTEGER,
  hints_used INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS lab_sessions (
  session_id TEXT PRIMARY KEY,
  lab_id TEXT NOT NULL,
  container_id TEXT,
  ports_json TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  validation_state TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS achievements (
  achievement_id TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lab_sessions_lab_id ON lab_sessions(lab_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question_id ON question_attempts(question_id);

INSERT OR IGNORE INTO user_profile (id, xp, level, total_completed, validation_passes, created_at, updated_at)
VALUES (1, 0, 1, 0, 0, datetime('now'), datetime('now'));
