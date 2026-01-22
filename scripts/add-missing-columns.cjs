#!/usr/bin/env node

/**
 * Script to add any missing columns to existing tables
 */

require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function addMissingColumns() {
  console.log('Checking and adding missing columns...\n');

  if (!process.env.POSTGRES_URL) {
    console.error('ERROR: POSTGRES_URL not configured');
    process.exit(1);
  }

  try {
    // Add missing columns to users table
    console.log('[1/12] Adding name column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)`;
    console.log('✅ Done\n');

    console.log('[2/12] Adding role column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`;
    console.log('✅ Done\n');

    console.log('[3/12] Adding client_id column...');
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id SERIAL`;
    } catch (e) {
      console.log('⚠️ client_id exists or skipped\n');
    }

    console.log('[4/12] Adding account_type column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'production'`;
    console.log('✅ Done\n');

    console.log('[5/12] Adding account_status column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active'`;
    console.log('✅ Done\n');

    console.log('[6/12] Adding internal_notes column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS internal_notes TEXT`;
    console.log('✅ Done\n');

    console.log('[7/12] Adding tags column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tags TEXT[]`;
    console.log('✅ Done\n');

    console.log('[8/12] Adding last_activity_at column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE`;
    console.log('✅ Done\n');

    console.log('[9/12] Adding total_cost_usd column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_cost_usd DECIMAL(10, 2) DEFAULT 0.00`;
    console.log('✅ Done\n');

    console.log('[10/12] Adding monthly_budget_usd column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_budget_usd DECIMAL(10, 2) DEFAULT NULL`;
    console.log('✅ Done\n');

    console.log('[11/12] Adding updated_at column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
    console.log('✅ Done\n');

    console.log('[12/12] Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at DESC)`;
    console.log('✅ Done\n');

    console.log('✅ All missing columns added successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error adding columns:');
    console.error(error);
    process.exit(1);
  }
}

addMissingColumns();
