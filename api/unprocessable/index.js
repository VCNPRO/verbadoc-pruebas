const { sql } = require('@vercel/postgres');

// VERSIÓN SIMPLIFICADA TEMPORAL

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = '3360dfa5-mock-test-0000-000000000000';

  // GET - Listar documentos no procesables
  if (req.method === 'GET') {
    try {
      const { limit = '100', category } = req.query;

      let result;
      if (category && category !== 'all') {
        result = await sql`
          SELECT id, filename, rejection_category, rejection_reason,
                 numero_expediente, numero_accion, numero_grupo,
                 extracted_data, retry_count, created_at
          FROM unprocessable_documents
          WHERE rejection_category = ${category}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } else {
        result = await sql`
          SELECT id, filename, rejection_category, rejection_reason,
                 numero_expediente, numero_accion, numero_grupo,
                 extracted_data, retry_count, created_at
          FROM unprocessable_documents
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      }

      // Stats
      const stats = await sql`
        SELECT rejection_category, COUNT(*) as count
        FROM unprocessable_documents
        GROUP BY rejection_category
      `;

      return res.status(200).json({
        documents: result.rows,
        stats: stats.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error GET unprocessable:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Registrar documento no procesable
  if (req.method === 'POST') {
    try {
      const { filename, category, reason, extractedData } = req.body;

      if (!filename || !category || !reason) {
        return res.status(400).json({
          error: 'Faltan campos: filename, category, reason'
        });
      }

      const result = await sql`
        INSERT INTO unprocessable_documents (
          user_id, filename, rejection_category, rejection_reason, extracted_data
        ) VALUES (
          ${userId}::uuid, ${filename}, ${category}, ${reason},
          ${extractedData ? JSON.stringify(extractedData) : '{}'}::jsonb
        )
        RETURNING id
      `;

      return res.status(201).json({
        success: true,
        id: result.rows[0].id
      });
    } catch (error) {
      console.error('Error POST unprocessable:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // DELETE - Eliminar documento
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID requerido' });

      await sql`DELETE FROM unprocessable_documents WHERE id = ${id}`;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error DELETE unprocessable:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
