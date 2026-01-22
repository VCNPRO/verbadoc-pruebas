#!/usr/bin/env node

/**
 * Script to initialize the database with all required tables and columns
 *
 * Usage:
 *   node scripts/init-db.js
 *
 * Requirements:
 *   - POSTGRES_URL environment variable configured
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { sql } = require('@vercel/postgres');

async function initDatabase() {
  console.log('==============================================');
  console.log('  Database Initialization - Verbadoc Pro      ');
  console.log('==============================================\n');

  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ ERROR: POSTGRES_URL or DATABASE_URL environment variable not configured\n');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to database...\n');

    // 1. Create users table with all necessary columns
    console.log('[1/6] Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user',
        client_id SERIAL,
        account_type VARCHAR(20) DEFAULT 'production',
        account_status VARCHAR(20) DEFAULT 'active',
        internal_notes TEXT,
        tags TEXT[],
        last_activity_at TIMESTAMP WITH TIME ZONE,
        total_cost_usd DECIMAL(10, 2) DEFAULT 0.00,
        monthly_budget_usd DECIMAL(10, 2) DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Users table created\n');

    // 2. Create indexes for users
    console.log('[2/6] Creating indexes for users table...');
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at DESC)`;
    console.log('✅ Indexes created\n');

    // 3. Create transcriptions table
    console.log('[3/6] Creating transcriptions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        audio_url TEXT,
        txt_url TEXT,
        srt_url TEXT,
        summary_url TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON transcriptions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC)`;
    console.log('✅ Transcriptions table created\n');

    // 4. Create usage_logs table
    console.log('[4/6] Creating usage_logs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        file_size_mb DECIMAL(10, 2),
        duration_seconds INT,
        tokens_input INT,
        tokens_output INT,
        cost_usd DECIMAL(10, 6),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_event_type ON usage_logs(event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC)`;
    console.log('✅ Usage logs table created\n');

    // 5. Create system_alerts table
    console.log('[5/6] Creating system_alerts table...');
    await sql`
      CREATE TABLE IF NOT EXISTS system_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        metadata JSONB,
        is_resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_type ON system_alerts(alert_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON system_alerts(severity)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON system_alerts(is_resolved)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON system_alerts(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON system_alerts(created_at DESC)`;
    console.log('✅ System alerts table created\n');

    // 6. Create alert_config table
    console.log('[6/6] Creating alert_config table...');
    await sql`
      CREATE TABLE IF NOT EXISTS alert_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type VARCHAR(50) NOT NULL UNIQUE,
        is_enabled BOOLEAN DEFAULT TRUE,
        threshold_value DECIMAL(10, 2),
        notification_emails TEXT[],
        check_interval_minutes INT DEFAULT 60,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Alert config table created\n');

    // Insert default alert configurations
    console.log('📝 Inserting default alert configurations...');
    await sql`
      INSERT INTO alert_config (alert_type, is_enabled, threshold_value, notification_emails, check_interval_minutes)
      VALUES
        ('high_cost_user', TRUE, 10.00, ARRAY['admin@verbadocpro.eu'], 60),
        ('quota_exceeded', TRUE, NULL, ARRAY['admin@verbadocpro.eu'], 30),
        ('service_error', TRUE, NULL, ARRAY['admin@verbadocpro.eu'], 5),
        ('storage_high', TRUE, 50.00, ARRAY['admin@verbadocpro.eu'], 120)
      ON CONFLICT (alert_type) DO NOTHING
    `;
    console.log('✅ Default configurations inserted\n');

    console.log('==============================================');
    console.log('     Database Initialized Successfully!      ');
    console.log('==============================================\n');

    console.log('📝 Next steps:');
    console.log('   1. Create your first admin user:');
    console.log('      node scripts/make-admin.js <email>\n');
    console.log('   2. Access the admin dashboard at /admin\n');

  } catch (error) {
    console.error('\n❌ ERROR INITIALIZING DATABASE:\n');
    console.error(error);
    console.error('\nDatabase initialization failed. Please review the error and try again.\n');
    process.exit(1);
  }
}

// Run the initialization
initDatabase()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:\n', error);
    process.exit(1);
  });
