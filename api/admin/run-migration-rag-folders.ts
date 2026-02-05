/**
 * API ENDPOINT: /api/admin/run-migration-rag-folders
 * Ejecuta la migración: tabla rag_folders + columna folder_id en extraction_results
 *
 * IMPORTANTE: Solo accesible por admin
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

function verifyAdminAuth(req: VercelRequest): boolean {
  try {
    const token = req.cookies['auth-token'];
    if (!token) return false;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return decoded.role === 'admin';
  } catch (error) {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!verifyAdminAuth(req)) {
    return res.status(403).json({ error: 'Solo administradores pueden ejecutar migraciones' });
  }

  try {
    console.log('Ejecutando migración: rag_folders');

    // 1. Crear tabla rag_folders
    await sql`
      CREATE TABLE IF NOT EXISTS rag_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      )
    `;
    console.log('Tabla rag_folders creada');

    // 2. Crear índices
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_folders_user ON rag_folders(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_folders_name ON rag_folders(user_id, name)`;
    console.log('Índices creados');

    // 3. Añadir columna folder_id a extraction_results
    await sql`
      ALTER TABLE extraction_results
        ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES rag_folders(id)
    `;
    console.log('Columna folder_id añadida a extraction_results');

    // 4. Índice para folder_id
    await sql`CREATE INDEX IF NOT EXISTS idx_extraction_results_folder ON extraction_results(folder_id)`;
    console.log('Índice folder_id creado');

    // 5. Verificar
    const check = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'rag_folders'
    `;

    if (check.rows.length === 0) {
      throw new Error('La tabla no se creó correctamente');
    }

    console.log('Migración rag_folders completada');

    return res.status(200).json({
      success: true,
      message: 'Migración rag_folders ejecutada correctamente',
      components: {
        tables: ['rag_folders'],
        columns_added: ['extraction_results.folder_id'],
        indices: 3
      }
    });

  } catch (error: any) {
    console.error('Error en migración rag_folders:', error);
    return res.status(500).json({
      error: 'Error ejecutando migración',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
