-- Migration: 006_operator_roles.sql
-- Description: Adds role column to users table for Role-Based Access Control (RBAC)

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'PLAYER' NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
