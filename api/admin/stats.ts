import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyAdmin } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigins = ['https://www.verbadocpro.eu', 'https://verbadoc-europa-pro.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Get total users count
    const usersResult = await sql`SELECT COUNT(*) as count FROM users`;
    const totalUsers = parseInt(usersResult.rows[0]?.count || '0');

    // Get users by role
    const roleResult = await sql`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
    `;
    const usersByRole = roleResult.rows.reduce((acc: any, row) => {
      acc[row.role] = parseInt(row.count);
      return acc;
    }, {});

    // Get total extractions (from extraction_results)
    const extractionsResult = await sql`SELECT COUNT(*) as count FROM extraction_results`;
    const totalExtractions = parseInt(extractionsResult.rows[0]?.count || '0');

    // Get extractions by validation_status
    const statusResult = await sql`
      SELECT validation_status, COUNT(*) as count
      FROM extraction_results
      GROUP BY validation_status
    `;
    const extractionsByStatus = statusResult.rows.reduce((acc: any, row) => {
      acc[row.validation_status || 'unknown'] = parseInt(row.count);
      return acc;
    }, {});

    // Get daily stats (last 30 days)
    const dailyResult = await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as extractions,
        COUNT(DISTINCT user_id) as active_users
      FROM extraction_results
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const dailyStats = dailyResult.rows;

    // Get top companies by extraction count
    const companiesResult = await sql`
      SELECT
        u.company_name,
        COUNT(er.id) as extraction_count,
        COUNT(DISTINCT er.user_id) as user_count
      FROM extraction_results er
      JOIN users u ON er.user_id = u.id
      WHERE u.company_name IS NOT NULL
      GROUP BY u.company_name
      ORDER BY extraction_count DESC
      LIMIT 10
    `;
    const topCompanies = companiesResult.rows;

    // Get recent extractions
    const recentResult = await sql`
      SELECT
        er.id,
        er.filename,
        er.validation_status,
        er.created_at,
        u.email,
        u.name,
        u.company_name
      FROM extraction_results er
      JOIN users u ON er.user_id = u.id
      ORDER BY er.created_at DESC
      LIMIT 20
    `;
    const recentExtractions = recentResult.rows;

    // Get error count (last 7 days) - extractions with 'invalid' status
    const errorsResult = await sql`
      SELECT COUNT(*) as count
      FROM extraction_results
      WHERE validation_status = 'invalid'
      AND created_at > NOW() - INTERVAL '7 days'
    `;
    const recentErrors = parseInt(errorsResult.rows[0]?.count || '0');

    // Get templates count
    const templatesResult = await sql`SELECT COUNT(*) as count FROM form_templates`;
    const totalTemplates = parseInt(templatesResult.rows[0]?.count || '0');

    // Get new users this month
    const newUsersResult = await sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at > DATE_TRUNC('month', CURRENT_DATE)
    `;
    const newUsersThisMonth = parseInt(newUsersResult.rows[0]?.count || '0');

    return res.status(200).json({
      users: {
        total: totalUsers,
        byRole: usersByRole,
        newThisMonth: newUsersThisMonth,
      },
      extractions: {
        total: totalExtractions,
        byStatus: extractionsByStatus,
        recentErrors,
      },
      templates: {
        total: totalTemplates,
      },
      dailyStats,
      topCompanies,
      recentExtractions,
    });

  } catch (error: any) {
    console.error('Error en /api/admin/stats:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
