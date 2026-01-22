import { sql } from '@vercel/postgres';

// ⚠️ VERSIÓN SIMPLIFICADA TEMPORAL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - Listar filas del Excel master
  if (req.method === 'GET') {
    try {
      const { limit = '1000' } = req.query;

      const result = await sql`
        SELECT id, extraction_id, row_data, row_number, filename,
               validation_status, cross_validation_match, discrepancy_count,
               version, created_at, updated_at
        FROM master_excel_output
        WHERE is_latest = true
          AND validation_status != 'needs_review'
        ORDER BY row_number ASC, created_at DESC
        LIMIT ${parseInt(limit)}
      `;

      // Stats simplificadas
      const statsResult = await sql`
        SELECT
          COUNT(*)::INTEGER AS total_rows,
          COUNT(*) FILTER (WHERE validation_status = 'pending')::INTEGER AS pending,
          COUNT(*) FILTER (WHERE validation_status = 'valid')::INTEGER AS valid,
          COUNT(*) FILTER (WHERE validation_status = 'approved')::INTEGER AS approved
        FROM master_excel_output
        WHERE is_latest = true
      `;

      return res.status(200).json({
        rows: result.rows,
        stats: statsResult.rows[0],
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error GET master-excel:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Agregar fila
  if (req.method === 'POST') {
    try {
      const { extraction_id, row_data, filename, validation_status = 'pending' } = req.body;
      const userId = '3360dfa5-mock-test-0000-000000000000';

      if (!extraction_id || !row_data || !filename) {
        return res.status(400).json({ error: 'Faltan campos: extraction_id, row_data, filename' });
      }

      // Obtener siguiente row_number
      const maxRow = await sql`SELECT COALESCE(MAX(row_number), 0) + 1 as next FROM master_excel_output`;
      const nextRowNumber = maxRow.rows[0].next;

      const result = await sql`
        INSERT INTO master_excel_output (
          user_id, extraction_id, row_data, row_number, filename, validation_status, is_latest
        ) VALUES (
          ${userId}::uuid, ${extraction_id}::uuid, ${JSON.stringify(row_data)}::jsonb,
          ${nextRowNumber}, ${filename}, ${validation_status}, true
        )
        RETURNING *
      `;

      return res.status(201).json({ success: true, row: result.rows[0] });
    } catch (error) {
      console.error('Error POST master-excel:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // DELETE - Eliminar filas
  if (req.method === 'DELETE') {
    try {
      const { ids, deleteAll } = req.body;

      if (deleteAll === true) {
        const result = await sql`DELETE FROM master_excel_output`;
        return res.status(200).json({ success: true, count: result.rowCount });
      }

      if (Array.isArray(ids) && ids.length > 0) {
        const result = await sql.query(
          'DELETE FROM master_excel_output WHERE id = ANY($1)',
          [ids]
        );
        return res.status(200).json({ success: true, count: result.rowCount });
      }

      return res.status(400).json({ error: 'Proporcionar ids[] o deleteAll=true' });
    } catch (error) {
      console.error('Error DELETE master-excel:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
