// Endpoint temporal para ejecutar la migración 014
// ELIMINAR DESPUÉS DE USAR

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo permitir GET para facilitar la ejecución
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ejecutar migración
    await sql`
      ALTER TABLE form_templates
      ADD COLUMN IF NOT EXISTS page_previews JSONB
    `;

    // Añadir comentario
    await sql`
      COMMENT ON COLUMN form_templates.page_previews IS 'Array de strings base64 con las previsualizaciones de cada página del documento maestro.'
    `;

    return res.status(200).json({
      success: true,
      message: '✅ Migración 014 ejecutada correctamente: columna page_previews añadida a form_templates'
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
