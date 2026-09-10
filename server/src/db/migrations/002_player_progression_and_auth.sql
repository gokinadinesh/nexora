CREATE TABLE IF NOT EXISTS player_auth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name VARCHAR(50) NOT NULL, -- e.g., 'google', 'email'
  provider_sub VARCHAR(255) NOT NULL, -- provider's unique ID for the user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_player_auth_providers UNIQUE (provider_name, provider_sub)
);
CREATE INDEX IF NOT EXISTS idx_player_auth_providers_user_id ON player_auth_providers (user_id);

CREATE TABLE IF NOT EXISTS player_progression (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  milestone_title VARCHAR(100) DEFAULT 'Recruit',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  source VARCHAR(100) NOT NULL,
  amount INT NOT NULL,
  previous_xp INT NOT NULL,
  new_xp INT NOT NULL,
  previous_level INT NOT NULL,
  new_level INT NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON xp_transactions (user_id);
