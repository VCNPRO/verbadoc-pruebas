-- Migration 017: Add preferred_language to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'es';
