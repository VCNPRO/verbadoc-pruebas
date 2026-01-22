import { sql } from '@vercel/postgres';

// VERSIÓN SIMPLIFICADA TEMPORAL
// Devuelve JSON en lugar de generar Excel (se puede hacer en frontend)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { since } = req.query;

    let result;
    if (since) {
      // Sincronización incremental
      result = await sql`
        SELECT row_number, row_data, filename, validation_status,
               cross_validation_match, discrepancy_count, created_at, updated_at
        FROM master_excel_output
        WHERE is_latest = true
          AND validation_status != 'needs_review'
          AND updated_at > ${since}
        ORDER BY row_number ASC
      `;
    } else {
      // Sincronización completa
      result = await sql`
        SELECT row_number, row_data, filename, validation_status,
               cross_validation_match, discrepancy_count, created_at, updated_at
        FROM master_excel_output
        WHERE is_latest = true
          AND validation_status != 'needs_review'
        ORDER BY row_number ASC
        LIMIT 500
      `;
    }

    return res.status(200).json({
      success: true,
      rows: result.rows,
      count: result.rows.length,
      lastSync: new Date().toISOString(),
      message: result.rows.length === 0 ? 'No hay datos nuevos para sincronizar' : 'Datos para sincronización'
    });
  } catch (error) {
    console.error('Error sync download:', error);
    return res.status(500).json({ error: error.message });
  }
}
