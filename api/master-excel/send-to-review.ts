/**
 * API: Enviar registros del Excel Master a Revisión
 * POST /api/master-excel/send-to-review
 *
 * Mueve registros del Excel Master a estado "needs_review"
 * para que puedan ser editados y luego vueltos a aprobar.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigins = [
    'https://www.verbadocpro.eu',
    'https://verbadoc-europa-pro.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar autenticación
  try {
    const token = req.cookies['auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.id || decoded.userId;

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de IDs' });
    }

    console.log(`📝 Enviando ${ids.length} registros a revisión...`);

    // 1. Obtener los extraction_id de los registros seleccionados
    const masterRows = await sql`
      SELECT id, extraction_id, row_data, filename
      FROM master_excel_output
      WHERE id = ANY(${ids}::uuid[])
      AND user_id = ${userId}::uuid
    `;

    if (masterRows.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron registros' });
    }

    console.log(`   Encontrados ${masterRows.rows.length} registros`);

    // 2. Actualizar el estado en extraction_results a 'needs_review'
    const extractionIds = masterRows.rows
      .map(r => r.extraction_id)
      .filter(id => id); // Filtrar nulls

    if (extractionIds.length > 0) {
      await sql`
        UPDATE extraction_results
        SET validation_status = 'needs_review',
            updated_at = NOW()
        WHERE id = ANY(${extractionIds}::uuid[])
      `;
      console.log(`   Actualizados ${extractionIds.length} extraction_results a needs_review`);
    }

    // 3. Marcar los registros del master_excel como "en revisión"
    // Opción A: Cambiar validation_status a 'needs_review'
    // Opción B: Eliminarlos del master_excel (y se recrearán al aprobar)
    // Usamos opción A para no perder datos
    await sql`
      UPDATE master_excel_output
      SET validation_status = 'needs_review',
          updated_at = NOW()
      WHERE id = ANY(${ids}::uuid[])
      AND user_id = ${userId}::uuid
    `;

    console.log(`✅ ${masterRows.rows.length} registros enviados a revisión`);

    return res.status(200).json({
      success: true,
      count: masterRows.rows.length,
      message: `${masterRows.rows.length} registro(s) enviado(s) a revisión`
    });

  } catch (error: any) {
    console.error('❌ Error al enviar a revisión:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    return res.status(500).json({
      error: 'Error al enviar a revisión',
      message: error.message
    });
  }
}
