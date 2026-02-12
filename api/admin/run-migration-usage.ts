import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyAdmin } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const results: string[] = [];

    // 1. Create usage_events table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS usage_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID,
          user_email VARCHAR(255),
          company_name VARCHAR(255),
          event_type VARCHAR(50) NOT NULL,
          event_subtype VARCHAR(100),
          app_id VARCHAR(50) DEFAULT 'verbadocpro',
          service_provider VARCHAR(50) NOT NULL,
          model_id VARCHAR(100),
          prompt_tokens INTEGER DEFAULT 0,
          completion_tokens INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          units_consumed NUMERIC DEFAULT 0,
          unit_type VARCHAR(50),
          cost_usd NUMERIC(12, 8) DEFAULT 0,
          resource_id VARCHAR(255),
          resource_name VARCHAR(500),
          processing_time_ms INTEGER,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      results.push('Created usage_events table');
    } catch (e: any) {
      results.push(`usage_events: ${e.message}`);
    }

    // 2. Create indexes for usage_events
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_usage_events_company_date ON usage_events (company_name, created_at DESC)`;
      results.push('Created index: company_date');
    } catch (e: any) {
      results.push(`idx_company_date: ${e.message}`);
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_usage_events_user_date ON usage_events (user_id, created_at DESC)`;
      results.push('Created index: user_date');
    } catch (e: any) {
      results.push(`idx_user_date: ${e.message}`);
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events (event_type)`;
      results.push('Created index: event_type');
    } catch (e: any) {
      results.push(`idx_event_type: ${e.message}`);
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events (created_at DESC)`;
      results.push('Created index: created_at');
    } catch (e: any) {
      results.push(`idx_created: ${e.message}`);
    }

    // 3. Create pricing_config table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS pricing_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_provider VARCHAR(50) NOT NULL,
          model_id VARCHAR(100),
          input_cost_per_million_tokens NUMERIC(12, 6) DEFAULT 0,
          output_cost_per_million_tokens NUMERIC(12, 6) DEFAULT 0,
          cost_per_unit NUMERIC(12, 8) DEFAULT 0,
          unit_type VARCHAR(50),
          effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          effective_until TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      results.push('Created pricing_config table');
    } catch (e: any) {
      results.push(`pricing_config: ${e.message}`);
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_pricing_config_provider_model ON pricing_config (service_provider, model_id)`;
      results.push('Created index: pricing_provider_model');
    } catch (e: any) {
      results.push(`idx_pricing: ${e.message}`);
    }

    // 4. Seed pricing data (only if table is empty)
    try {
      const existing = await sql`SELECT COUNT(*) as cnt FROM pricing_config`;
      if (parseInt(existing.rows[0].cnt) === 0) {
        await sql`INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes) VALUES ('gemini', 'gemini-2.0-flash', 0.10, 0.40, 'Gemini 2.0 Flash')`;
        await sql`INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes) VALUES ('gemini', 'gemini-2.5-flash', 0.15, 0.60, 'Gemini 2.5 Flash')`;
        await sql`INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes) VALUES ('gemini', 'gemini-2.5-flash-preview', 0.15, 0.60, 'Gemini 2.5 Flash Preview')`;
        await sql`INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes) VALUES ('gemini', 'gemini-3-flash-preview', 0.15, 0.60, 'Gemini 3 Flash Preview')`;
        await sql`INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes) VALUES ('gemini', 'gemini-1.5-pro', 1.25, 5.00, 'Gemini 1.5 Pro')`;
        await sql`INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes) VALUES ('gemini_embedding', 'gemini-embedding-001', 0.004, 0.0, 'Gemini Embedding')`;
        await sql`INSERT INTO pricing_config (service_provider, model_id, cost_per_unit, unit_type, notes) VALUES ('vercel_blob', 'storage', 0.00000000023, 'bytes', 'Vercel Blob ~$0.23/GB/mes')`;
        await sql`INSERT INTO pricing_config (service_provider, model_id, cost_per_unit, unit_type, notes) VALUES ('resend', 'email', 0.001, 'emails', 'Resend ~$1/1000 emails')`;
        results.push('Seeded pricing_config with 8 entries');
      } else {
        results.push(`pricing_config already has ${existing.rows[0].cnt} entries, skipping seed`);
      }
    } catch (e: any) {
      results.push(`pricing seed: ${e.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Usage tracking migration completed',
      results
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
}
