import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyToken } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify user is logged in
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Get user quota info
    const result = await sql`
      SELECT
        monthly_quota_extractions,
        monthly_usage_extractions,
        subscription_plan,
        quota_reset_date
      FROM users
      WHERE id = ${user.id}
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userData = result.rows[0];
    const quota = userData.monthly_quota_extractions || 10;
    const usage = userData.monthly_usage_extractions || 0;
    const remaining = Math.max(0, quota - usage);
    const canExtract = remaining > 0;

    // Check if quota needs reset
    const resetDate = userData.quota_reset_date ? new Date(userData.quota_reset_date) : null;
    const needsReset = resetDate && resetDate <= new Date();

    // Auto-reset if needed
    if (needsReset) {
      await sql`
        UPDATE users
        SET
          monthly_usage_extractions = 0,
          quota_reset_date = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        WHERE id = ${user.id}
      `;

      return res.status(200).json({
        quota,
        usage: 0,
        remaining: quota,
        canExtract: true,
        plan: userData.subscription_plan || 'free',
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        wasReset: true
      });
    }

    return res.status(200).json({
      quota,
      usage,
      remaining,
      canExtract,
      plan: userData.subscription_plan || 'free',
      resetDate: userData.quota_reset_date
    });

  } catch (error: any) {
    console.error('Error checking quota:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
}
