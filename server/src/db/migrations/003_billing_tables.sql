-- Migration: 003_billing_tables
-- Description: Add billing fields to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100);
