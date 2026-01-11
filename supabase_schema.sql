-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: slack_users (Slack bot users)
CREATE TABLE IF NOT EXISTS public.slack_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slack_user_id TEXT NOT NULL UNIQUE,
  team_id TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: vocabulary (cached from Notion)
CREATE TABLE IF NOT EXISTS public.vocabulary (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  notion_page_id TEXT NOT NULL UNIQUE,
  english TEXT NOT NULL,
  japanese TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: test_sessions (each hourly test batch)
CREATE TABLE IF NOT EXISTS public.test_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  sent_at TIMESTAMPTZ,
  questions JSONB NOT NULL,
  status TEXT CHECK (status IN ('created', 'sent', 'completed')) DEFAULT 'created'
);

-- Table: user_test_attempts (tracks which user answered which test)
CREATE TABLE IF NOT EXISTS public.user_test_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES slack_users(id) ON DELETE CASCADE NOT NULL,
  test_session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  current_question_index INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  UNIQUE(user_id, test_session_id)
);

-- Table: user_answers (individual answers)
CREATE TABLE IF NOT EXISTS public.user_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES slack_users(id) ON DELETE CASCADE NOT NULL,
  test_session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE NOT NULL,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  question_type TEXT CHECK (question_type IN ('en_to_jp', 'jp_to_en', 'multiple_choice')) NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  options JSONB
);

-- Table: vocabulary_stats (adaptive difficulty tracking)
CREATE TABLE IF NOT EXISTS public.vocabulary_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES slack_users(id) ON DELETE CASCADE NOT NULL,
  total_attempts INTEGER DEFAULT 0,
  correct_attempts INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
  last_tested_at TIMESTAMPTZ,
  weight DECIMAL(10,4) DEFAULT 1.0,
  UNIQUE(vocabulary_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_slack_users_slack_user_id ON slack_users(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_users_team_id ON slack_users(team_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_user_id ON user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_vocabulary_id ON user_answers(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_stats_user_id ON vocabulary_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_stats_weight ON vocabulary_stats(user_id, weight DESC);
CREATE INDEX IF NOT EXISTS idx_test_sessions_status ON test_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_test_attempts_user_test ON user_test_attempts(user_id, test_session_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_notion_page_id ON vocabulary(notion_page_id);

-- RLS Policies (Row Level Security)
ALTER TABLE slack_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_test_attempts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API routes)
CREATE POLICY "Service role has full access on slack_users"
  ON slack_users FOR ALL
  USING (true);

CREATE POLICY "Service role has full access on vocabulary"
  ON vocabulary FOR ALL
  USING (true);

CREATE POLICY "Service role has full access on test_sessions"
  ON test_sessions FOR ALL
  USING (true);

CREATE POLICY "Service role has full access on user_answers"
  ON user_answers FOR ALL
  USING (true);

CREATE POLICY "Service role has full access on vocabulary_stats"
  ON vocabulary_stats FOR ALL
  USING (true);

CREATE POLICY "Service role has full access on user_test_attempts"
  ON user_test_attempts FOR ALL
  USING (true);

-- Function: Update vocabulary stats after answer
CREATE OR REPLACE FUNCTION update_vocabulary_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO vocabulary_stats (vocabulary_id, user_id, total_attempts, correct_attempts, last_tested_at)
  VALUES (NEW.vocabulary_id, NEW.user_id, 1, CASE WHEN NEW.is_correct THEN 1 ELSE 0 END, NEW.answered_at)
  ON CONFLICT (vocabulary_id, user_id) DO UPDATE SET
    total_attempts = vocabulary_stats.total_attempts + 1,
    correct_attempts = vocabulary_stats.correct_attempts + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    accuracy_rate = ROUND((vocabulary_stats.correct_attempts + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::DECIMAL / (vocabulary_stats.total_attempts + 1) * 100, 2),
    last_tested_at = NEW.answered_at,
    -- Weight calculation: inverse of accuracy rate (lower accuracy = higher weight)
    -- Add +0.1 to denominator to avoid division by zero and reduce extreme weights
    weight = CASE
      WHEN (vocabulary_stats.total_attempts + 1) < 3 THEN 1.0
      ELSE ROUND(1.0 / (((vocabulary_stats.correct_attempts + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::DECIMAL / (vocabulary_stats.total_attempts + 1)) + 0.1), 4)
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update stats after each answer
DROP TRIGGER IF EXISTS trigger_update_vocabulary_stats ON user_answers;
CREATE TRIGGER trigger_update_vocabulary_stats
AFTER INSERT ON user_answers
FOR EACH ROW
EXECUTE FUNCTION update_vocabulary_stats();

-- Function: Update user's last active timestamp
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE slack_users
  SET last_active_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update last_active_at when user answers
DROP TRIGGER IF EXISTS trigger_update_user_last_active ON user_answers;
CREATE TRIGGER trigger_update_user_last_active
AFTER INSERT ON user_answers
FOR EACH ROW
EXECUTE FUNCTION update_user_last_active();

-- Comments for documentation
COMMENT ON TABLE slack_users IS 'Slack users who interact with the bot';
COMMENT ON TABLE vocabulary IS 'English vocabulary cached from Notion database';
COMMENT ON TABLE test_sessions IS 'Hourly generated test sessions';
COMMENT ON TABLE user_test_attempts IS 'User progress tracking for each test session';
COMMENT ON TABLE user_answers IS 'Detailed answer history for analytics';
COMMENT ON TABLE vocabulary_stats IS 'Per-user, per-word statistics for adaptive difficulty';

COMMENT ON COLUMN vocabulary_stats.weight IS 'Calculated weight for selection probability (higher = more likely to appear)';
COMMENT ON COLUMN vocabulary_stats.accuracy_rate IS 'Percentage of correct answers (0-100)';
