CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(50),
  avatar VARCHAR(255) DEFAULT 'default_operative',
  role VARCHAR(20) DEFAULT 'PLAYER' NOT NULL,
  rating INT DEFAULT 1000 NOT NULL,
  wins INT DEFAULT 0 NOT NULL,
  losses INT DEFAULT 0 NOT NULL,
  matches_played INT DEFAULT 0 NOT NULL,
  total_score INT DEFAULT 0 NOT NULL,
  best_score INT DEFAULT 0 NOT NULL,
  current_win_streak INT DEFAULT 0 NOT NULL,
  best_win_streak INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users (rating DESC);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  winner_id UUID REFERENCES users(id),
  duration_seconds INT DEFAULT 0 NOT NULL,
  final_version INT DEFAULT 1 NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_ended_at ON matches (ended_at DESC);

CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  score INT DEFAULT 0 NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  rating_before INT DEFAULT 1000 NOT NULL,
  rating_after INT DEFAULT 1000 NOT NULL,
  rating_change INT DEFAULT 0 NOT NULL,
  CONSTRAINT uq_match_players_match_user UNIQUE (match_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players (match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user_id ON match_players (user_id);

CREATE TABLE IF NOT EXISTS game_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  state_version INT NOT NULL DEFAULT 1,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_game_states_match_id ON game_states (match_id);

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events (match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_timestamp ON match_events (timestamp DESC);
