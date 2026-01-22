import { sql } from '@vercel/postgres';

// VERSIÓN SIMPLIFICADA TEMPORAL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Por ahora solo devolver JSON con los datos
    // La generación del Excel se puede hacer en el frontend
    const result = await sql`
      SELECT id, row_data, filename, validation_status, created_at
      FROM master_excel_rows
      ORDER BY created_at DESC
      LIMIT 500
    `;

    return res.status(200).json({
      success: true,
      rows: result.rows,
      count: result.rows.length,
      message: 'Datos para sincronización'
    });
  } catch (error) {
    console.error('Error sync download:', error);
    return res.status(500).json({ error: error.message });
  }
}
