-- SysAdmin Game Registry API schema (MariaDB)

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified TINYINT NOT NULL DEFAULT 0,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  leaderboard_opt_in TINYINT NOT NULL DEFAULT 0,
  profile_public TINYINT NOT NULL DEFAULT 0,
  disabled TINYINT NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  device_label VARCHAR(255),
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS device_auth_sessions (
  device_code VARCHAR(128) PRIMARY KEY,
  user_code VARCHAR(16) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  user_id VARCHAR(64),
  client_label VARCHAR(255),
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  approved_at VARCHAR(32),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS labs (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(128) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  difficulty VARCHAR(32) NOT NULL DEFAULT 'beginner',
  runtime VARCHAR(32) NOT NULL DEFAULT 'docker',
  badges TEXT NOT NULL,
  tags TEXT NOT NULL,
  creator_id VARCHAR(64),
  creator_name VARCHAR(255),
  featured TINYINT NOT NULL DEFAULT 0,
  disabled TINYINT NOT NULL DEFAULT 0,
  suspicious_activity TINYINT NOT NULL DEFAULT 0,
  avg_rating DOUBLE NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  download_count INT NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lab_versions (
  id VARCHAR(64) PRIMARY KEY,
  lab_id VARCHAR(64) NOT NULL,
  version VARCHAR(32) NOT NULL,
  changelog TEXT NOT NULL,
  pack_filename VARCHAR(255) NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  signature TEXT,
  verified TINYINT NOT NULL DEFAULT 0,
  runtime_requirements TEXT NOT NULL,
  published_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_lab_version (lab_id, version),
  FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_reviews (
  id VARCHAR(64) PRIMARY KEY,
  lab_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_lab_review (lab_id, user_id),
  FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_reports (
  id VARCHAR(64) PRIMARY KEY,
  lab_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64),
  reason VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lab_downloads (
  id VARCHAR(64) PRIMARY KEY,
  lab_id VARCHAR(64) NOT NULL,
  version_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64),
  device_id VARCHAR(128),
  downloaded_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES lab_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_profile_remote (
  user_id VARCHAR(64) PRIMARY KEY,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  total_completed INT NOT NULL DEFAULT 0,
  updated_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS progress (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  lab_id VARCHAR(64) NOT NULL,
  lab_version VARCHAR(32) NOT NULL,
  completed TINYINT NOT NULL DEFAULT 0,
  xp_earned INT NOT NULL DEFAULT 0,
  best_time_sec INT,
  hints_used INT NOT NULL DEFAULT 0,
  validation_passed TINYINT NOT NULL DEFAULT 0,
  verified_completion TINYINT NOT NULL DEFAULT 0,
  completion_proof TEXT,
  device_id VARCHAR(128),
  completed_at VARCHAR(32),
  updated_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_progress_user_lab (user_id, lab_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  achievement_id VARCHAR(128) NOT NULL,
  unlocked_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_user_achievement (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  lab_id VARCHAR(64),
  display_name VARCHAR(255) NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  completed_labs INT NOT NULL DEFAULT 0,
  best_time_sec INT,
  hints_used INT NOT NULL DEFAULT 0,
  verified_only TINYINT NOT NULL DEFAULT 1,
  hidden TINYINT NOT NULL DEFAULT 0,
  updated_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_leaderboard_user_lab (user_id, lab_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id VARCHAR(64) PRIMARY KEY,
  email_lab_updates TINYINT NOT NULL DEFAULT 1,
  email_new_verified_labs TINYINT NOT NULL DEFAULT 1,
  email_lab_completions TINYINT NOT NULL DEFAULT 1,
  email_lab_deployment_ready TINYINT NOT NULL DEFAULT 1,
  email_leaderboard_milestones TINYINT NOT NULL DEFAULT 1,
  email_security_alerts TINYINT NOT NULL DEFAULT 1,
  updated_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64),
  action VARCHAR(128) NOT NULL,
  target_type VARCHAR(64),
  target_id VARCHAR(64),
  details TEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS email_rate_limits (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  event VARCHAR(64) NOT NULL,
  device_id VARCHAR(128),
  ip VARCHAR(64),
  sent_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  device_id VARCHAR(128),
  event VARCHAR(64) NOT NULL,
  ip VARCHAR(64),
  rate_limited TINYINT NOT NULL DEFAULT 0,
  provider VARCHAR(32),
  success TINYINT NOT NULL DEFAULT 0,
  error_code VARCHAR(64),
  created_at VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS email_action_tokens (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  kind VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  used_at VARCHAR(32),
  created_at VARCHAR(32) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_labs_category ON labs(category);
CREATE INDEX IF NOT EXISTS idx_labs_difficulty ON labs(difficulty);
CREATE INDEX IF NOT EXISTS idx_lab_versions_lab ON lab_versions(lab_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_xp ON leaderboard_entries(xp DESC);
CREATE INDEX IF NOT EXISTS idx_email_rate_user_event ON email_rate_limits(user_id, event, sent_at);
CREATE INDEX IF NOT EXISTS idx_email_action_token_hash ON email_action_tokens(token_hash);
