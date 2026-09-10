-- NEXORA Database Migration: 002_extend_user_profiles
-- Description: Adds competitive player profile columns to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) DEFAULT 'default_operative';
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating INT DEFAULT 1000 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wins INT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS losses INT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS matches_played INT DEFAULT 0 NOT NULL;

-- Index rating for leaderboard queries and matchmaking brackets
CREATE INDEX IF NOT EXISTS idx_users_rating ON users (rating DESC);
