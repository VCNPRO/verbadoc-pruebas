/**
 * API ENDPOINT: /api/admin/usage-stats
 *
 * Dashboard de consumos por empresa.
 * GET con parametros: period, from, to, companyName, groupBy
 */

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Parse parameters
    const period = (req.query.period as string) || 'month';
    const companyFilter = req.query.companyName as string | undefined;

    // Calculate date range
    let fromDate: string;
    const toDate = new Date().toISOString();

    if (req.query.from) {
      fromDate = req.query.from as string;
    } else {
      const now = new Date();
      switch (period) {
        case 'week':
          now.setDate(now.getDate() - 7);
          break;
        case 'quarter':
          now.setMonth(now.getMonth() - 3);
          break;
        case 'month':
        default:
          now.setMonth(now.getMonth() - 1);
          break;
      }
      fromDate = now.toISOString();
    }

    const finalTo = (req.query.to as string) || toDate;

    // 1. Summary totals
    let summaryResult;
    if (companyFilter) {
      summaryResult = await sql`
        SELECT
          COALESCE(SUM(cost_usd), 0) as total_cost,
          COUNT(*) as total_events,
          COALESCE(SUM(total_tokens), 0) as total_tokens
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
          AND company_name = ${companyFilter}
      `;
    } else {
      summaryResult = await sql`
        SELECT
          COALESCE(SUM(cost_usd), 0) as total_cost,
          COUNT(*) as total_events,
          COALESCE(SUM(total_tokens), 0) as total_tokens
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
      `;
    }

    const summary = {
      totalCostUsd: parseFloat(summaryResult.rows[0].total_cost) || 0,
      totalEvents: parseInt(summaryResult.rows[0].total_events) || 0,
      totalTokens: parseInt(summaryResult.rows[0].total_tokens) || 0,
      period,
      from: fromDate,
      to: finalTo,
    };

    // 2. Breakdown by company
    let byCompanyResult;
    if (companyFilter) {
      byCompanyResult = await sql`
        SELECT
          COALESCE(company_name, 'Sin empresa') as company_name,
          event_type,
          COUNT(*) as event_count,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COALESCE(SUM(cost_usd), 0) as cost
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
          AND company_name = ${companyFilter}
        GROUP BY company_name, event_type
        ORDER BY cost DESC
      `;
    } else {
      byCompanyResult = await sql`
        SELECT
          COALESCE(company_name, 'Sin empresa') as company_name,
          event_type,
          COUNT(*) as event_count,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COALESCE(SUM(cost_usd), 0) as cost
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
        GROUP BY company_name, event_type
        ORDER BY cost DESC
      `;
    }

    // Aggregate by company
    const companiesMap = new Map<string, any>();
    for (const row of byCompanyResult.rows) {
      const name = row.company_name;
      if (!companiesMap.has(name)) {
        companiesMap.set(name, {
          companyName: name,
          totalCostUsd: 0,
          totalEvents: 0,
          totalTokens: 0,
          breakdown: {},
        });
      }
      const company = companiesMap.get(name);
      const count = parseInt(row.event_count) || 0;
      const tokens = parseInt(row.tokens) || 0;
      const cost = parseFloat(row.cost) || 0;

      company.totalCostUsd += cost;
      company.totalEvents += count;
      company.totalTokens += tokens;
      company.breakdown[row.event_type] = {
        count,
        tokens,
        costUsd: Math.round(cost * 100000000) / 100000000,
      };
    }

    const byCompany = Array.from(companiesMap.values())
      .map(c => ({
        ...c,
        totalCostUsd: Math.round(c.totalCostUsd * 100000000) / 100000000,
      }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    // 3. Daily trend
    let dailyResult;
    if (companyFilter) {
      dailyResult = await sql`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as events,
          COALESCE(SUM(cost_usd), 0) as cost,
          COALESCE(SUM(total_tokens), 0) as tokens
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
          AND company_name = ${companyFilter}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
    } else {
      dailyResult = await sql`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as events,
          COALESCE(SUM(cost_usd), 0) as cost,
          COALESCE(SUM(total_tokens), 0) as tokens
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
    }

    const dailyTrend = dailyResult.rows.map(row => ({
      date: row.date,
      events: parseInt(row.events) || 0,
      costUsd: parseFloat(row.cost) || 0,
      tokens: parseInt(row.tokens) || 0,
    }));

    // 4. Breakdown by model
    let byModelResult;
    if (companyFilter) {
      byModelResult = await sql`
        SELECT
          COALESCE(model_id, 'unknown') as model_id,
          COUNT(*) as events,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COALESCE(SUM(cost_usd), 0) as cost
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
          AND company_name = ${companyFilter}
        GROUP BY model_id
        ORDER BY cost DESC
      `;
    } else {
      byModelResult = await sql`
        SELECT
          COALESCE(model_id, 'unknown') as model_id,
          COUNT(*) as events,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COALESCE(SUM(cost_usd), 0) as cost
        FROM usage_events
        WHERE created_at >= ${fromDate}::timestamptz
          AND created_at <= ${finalTo}::timestamptz
        GROUP BY model_id
        ORDER BY cost DESC
      `;
    }

    const byModel = byModelResult.rows.map(row => ({
      modelId: row.model_id,
      events: parseInt(row.events) || 0,
      tokens: parseInt(row.tokens) || 0,
      costUsd: parseFloat(row.cost) || 0,
    }));

    // 5. Available companies (for filter dropdown)
    const companiesListResult = await sql`
      SELECT DISTINCT COALESCE(company_name, 'Sin empresa') as company_name
      FROM usage_events
      WHERE company_name IS NOT NULL
      ORDER BY company_name
    `;
    const availableCompanies = companiesListResult.rows.map(r => r.company_name);

    return res.status(200).json({
      summary,
      byCompany,
      dailyTrend,
      byModel,
      availableCompanies,
    });

  } catch (error: any) {
    console.error('[usage-stats] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
