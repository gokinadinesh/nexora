-- NEXORA Database Migration: 003_create_replays
-- Description: Creates replay_records table for storing authoritative match event timelines.

CREATE TABLE IF NOT EXISTS replay_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  replay_version INT DEFAULT 1 NOT NULL,
  duration_seconds INT DEFAULT 0 NOT NULL,
  initial_state JSONB NOT NULL,
  event_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_replay_match UNIQUE (match_id)
);

CREATE INDEX IF NOT EXISTS idx_replay_records_match_id ON replay_records (match_id);
