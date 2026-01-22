import { sql } from '@vercel/postgres';

// ⚠️ VERSIÓN SIMPLIFICADA TEMPORAL para pruebas

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - Listar extracciones
  if (req.method === 'GET') {
    try {
      const { limit = '50', needsReview } = req.query;

      let result;
      if (needsReview === 'true') {
        result = await sql`
          SELECT id, filename, extracted_data, validation_status as status,
                 validation_errors_count, created_at, updated_at
          FROM extraction_results
          WHERE validation_errors_count > 0 OR validation_status = 'needs_review'
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      } else {
        result = await sql`
          SELECT id, filename, extracted_data, validation_status as status,
                 validation_errors_count, created_at, updated_at
          FROM extraction_results
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)}
        `;
      }

      // Stats simplificadas
      const statsResult = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE validation_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE validation_status = 'valid' OR validation_status = 'approved') as valid,
          COUNT(*) FILTER (WHERE validation_errors_count > 0) as needs_review
        FROM extraction_results
      `;

      return res.status(200).json({
        extractions: result.rows,
        stats: {
          total: parseInt(statsResult.rows[0].total),
          pending: parseInt(statsResult.rows[0].pending),
          valid: parseInt(statsResult.rows[0].valid),
          needsReview: parseInt(statsResult.rows[0].needs_review),
          rejected: 0
        },
        count: result.rows.length
      });
    } catch (error) {
      console.error('Error GET extractions:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Crear extracción
  if (req.method === 'POST') {
    try {
      const { filename, extractedData, modelUsed, fileType, fileSizeBytes, pageCount, processingTimeMs, confidenceScore } = req.body;

      if (!filename || !extractedData) {
        return res.status(400).json({ error: 'Missing filename or extractedData' });
      }

      const userId = '3360dfa5-mock-test-0000-000000000000'; // Usuario bypass temporal

      const result = await sql`
        INSERT INTO extraction_results (
          user_id, filename, extracted_data, model_used,
          file_type, file_size_bytes, page_count, processing_time_ms,
          confidence_score, validation_status
        ) VALUES (
          ${userId}::uuid, ${filename}, ${JSON.stringify(extractedData)}::jsonb, ${modelUsed || 'coordinates'},
          ${fileType || 'application/pdf'}, ${fileSizeBytes || 0}, ${pageCount || 1}, ${processingTimeMs || 0},
          ${confidenceScore || 0.8}, 'pending'
        )
        RETURNING *
      `;

      return res.status(201).json({
        success: true,
        extraction: result.rows[0]
      });
    } catch (error) {
      console.error('Error POST extractions:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
