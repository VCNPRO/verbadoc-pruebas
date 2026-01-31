-- Migration 016: Add company_name to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- Set Normadat for client_id=3
UPDATE users SET company_name = 'Normadat' WHERE client_id = 3;
