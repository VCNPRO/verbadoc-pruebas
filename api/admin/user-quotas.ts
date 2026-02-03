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

    // GET - Get all users with quota info
    if (req.method === 'GET') {
      const result = await sql`
        SELECT
          id,
          email,
          name,
          role,
          company_name,
          subscription_plan,
          monthly_quota_extractions,
          monthly_usage_extractions,
          quota_reset_date,
          created_at
        FROM users
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ users: result.rows });
    }

    // PATCH - Update user quota
    if (req.method === 'PATCH') {
      const { userId, quota, plan, resetUsage } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId es requerido' });
      }

      // Build update query dynamically
      const updates: string[] = [];

      if (quota !== undefined) {
        const quotaNum = parseInt(quota);
        if (isNaN(quotaNum) || quotaNum < 0) {
          return res.status(400).json({ error: 'Cuota inválida' });
        }
        await sql`
          UPDATE users
          SET monthly_quota_extractions = ${quotaNum}
          WHERE id = ${userId}
        `;
        updates.push(`quota=${quotaNum}`);
      }

      if (plan !== undefined) {
        const validPlans = ['free', 'pro', 'enterprise'];
        if (!validPlans.includes(plan)) {
          return res.status(400).json({ error: 'Plan inválido' });
        }

        // Set quota based on plan
        let defaultQuota = 10;
        if (plan === 'pro') defaultQuota = 100;
        if (plan === 'enterprise') defaultQuota = 1000;

        await sql`
          UPDATE users
          SET subscription_plan = ${plan},
              monthly_quota_extractions = ${defaultQuota}
          WHERE id = ${userId}
        `;
        updates.push(`plan=${plan}, quota=${defaultQuota}`);
      }

      if (resetUsage === true) {
        await sql`
          UPDATE users
          SET monthly_usage_extractions = 0,
              quota_reset_date = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          WHERE id = ${userId}
        `;
        updates.push('usage reset to 0');
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay cambios para aplicar' });
      }

      // Get updated user
      const result = await sql`
        SELECT
          id, email, name, subscription_plan,
          monthly_quota_extractions, monthly_usage_extractions, quota_reset_date
        FROM users WHERE id = ${userId}
      `;

      return res.status(200).json({
        success: true,
        message: `Actualizado: ${updates.join(', ')}`,
        user: result.rows[0]
      });
    }

    // POST - Reset all quotas (monthly cron job)
    if (req.method === 'POST') {
      const { action } = req.body;

      if (action === 'reset_all_monthly') {
        const result = await sql`
          UPDATE users
          SET
            monthly_usage_extractions = 0,
            quota_reset_date = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          WHERE quota_reset_date <= CURRENT_DATE
        `;

        return res.status(200).json({
          success: true,
          message: `Cuotas reseteadas para ${result.rowCount} usuarios`
        });
      }

      if (action === 'increment_usage') {
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ error: 'userId requerido' });
        }

        await sql`
          UPDATE users
          SET monthly_usage_extractions = monthly_usage_extractions + 1
          WHERE id = ${userId}
        `;

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Acción no válida' });
    }

    res.setHeader('Allow', ['GET', 'PATCH', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error: any) {
    console.error('Error en /api/admin/user-quotas:', error);
    return res.status(500).json({ error: error.message });
  }
}
