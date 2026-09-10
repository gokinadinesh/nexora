-- Migration: 005_competitive_progression.sql
-- Description: Adds competitive statistics to users, duration and version to matches, and rating deltas to match_players

-- 1. Extend users table with competitive progression metrics
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_score INT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS best_score INT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_win_streak INT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS best_win_streak INT DEFAULT 0 NOT NULL;

-- 2. Extend matches table with duration and final state version
ALTER TABLE matches ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0 NOT NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS final_version INT DEFAULT 1 NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_ended_at ON matches (ended_at DESC);

-- 3. Extend match_players with rating progression tracking
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS rating_before INT DEFAULT 1000 NOT NULL;
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS rating_after INT DEFAULT 1000 NOT NULL;
ALTER TABLE match_players ADD COLUMN IF NOT EXISTS rating_change INT DEFAULT 0 NOT NULL;
