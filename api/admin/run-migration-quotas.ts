import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyAdmin } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Verify admin
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const results: string[] = [];

    // Add quota fields to users table
    try {
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS monthly_quota_extractions INTEGER DEFAULT 10
      `;
      results.push('Added monthly_quota_extractions column');
    } catch (e: any) {
      results.push(`monthly_quota_extractions: ${e.message}`);
    }

    try {
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS monthly_usage_extractions INTEGER DEFAULT 0
      `;
      results.push('Added monthly_usage_extractions column');
    } catch (e: any) {
      results.push(`monthly_usage_extractions: ${e.message}`);
    }

    try {
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free'
      `;
      results.push('Added subscription_plan column');
    } catch (e: any) {
      results.push(`subscription_plan: ${e.message}`);
    }

    try {
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS quota_reset_date TIMESTAMP DEFAULT (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
      `;
      results.push('Added quota_reset_date column');
    } catch (e: any) {
      results.push(`quota_reset_date: ${e.message}`);
    }

    // Set default values for existing users
    try {
      await sql`
        UPDATE users
        SET
          monthly_quota_extractions = COALESCE(monthly_quota_extractions, 10),
          monthly_usage_extractions = COALESCE(monthly_usage_extractions, 0),
          subscription_plan = COALESCE(subscription_plan, 'free'),
          quota_reset_date = COALESCE(quota_reset_date, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')
        WHERE monthly_quota_extractions IS NULL
           OR monthly_usage_extractions IS NULL
           OR subscription_plan IS NULL
           OR quota_reset_date IS NULL
      `;
      results.push('Updated existing users with default values');
    } catch (e: any) {
      results.push(`Update defaults: ${e.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Migration completed',
      results
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
}
