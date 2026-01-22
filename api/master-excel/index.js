import { sql } from '@vercel/postgres';

// ⚠️ VERSIÓN SIMPLIFICADA TEMPORAL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT id, extraction_id, data, filename, status, created_at
        FROM master_excel_rows
        ORDER BY created_at DESC
        LIMIT 100
      `;

      return res.status(200).json({
        rows: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
