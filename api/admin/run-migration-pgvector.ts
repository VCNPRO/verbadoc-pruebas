/**
 * API ENDPOINT: /api/admin/run-migration-pgvector
 * Habilita pgvector y crea tabla de embeddings
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
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  if (!verifyAdminAuth(req)) {
    return res.status(403).json({ error: 'Solo administradores pueden ejecutar migraciones' });
  }

  try {
    console.log('Ejecutando migracion pgvector...');

    // 1. Habilitar extension pgvector
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('Extension vector habilitada');

    // 2. Crear tabla de embeddings
    await sql`
      CREATE TABLE IF NOT EXISTS rag_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Referencia al documento
        document_id UUID NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Informacion del chunk
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,

        -- Vector embedding (768 dimensiones para Gemini)
        embedding vector(768) NOT NULL,

        -- Metadata
        document_name VARCHAR(500),
        metadata JSONB,

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),

        -- Constraint
        UNIQUE(document_id, chunk_index)
      )
    `;
    console.log('Tabla rag_embeddings creada');

    // 3. Crear indice HNSW para busqueda rapida
    await sql`
      CREATE INDEX IF NOT EXISTS idx_rag_embeddings_vector
      ON rag_embeddings
      USING hnsw (embedding vector_cosine_ops)
    `;
    console.log('Indice HNSW creado');

    // 4. Indices adicionales
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_embeddings_user ON rag_embeddings(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_embeddings_document ON rag_embeddings(document_id)`;
    console.log('Indices adicionales creados');

    // 5. Funcion de busqueda semantica
    await sql`
      CREATE OR REPLACE FUNCTION search_embeddings(
        query_embedding vector(768),
        match_user_id UUID,
        match_count INTEGER DEFAULT 5
      )
      RETURNS TABLE (
        id UUID,
        document_id UUID,
        document_name VARCHAR,
        chunk_index INTEGER,
        chunk_text TEXT,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          e.id,
          e.document_id,
          e.document_name,
          e.chunk_index,
          e.chunk_text,
          1 - (e.embedding <=> query_embedding) as similarity
        FROM rag_embeddings e
        WHERE e.user_id = match_user_id
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$
    `;
    console.log('Funcion search_embeddings creada');

    // 6. Habilitar RLS
    await sql`ALTER TABLE rag_embeddings ENABLE ROW LEVEL SECURITY`;

    await sql`DROP POLICY IF EXISTS rag_embeddings_user_isolation ON rag_embeddings`;

    await sql`
      CREATE POLICY rag_embeddings_user_isolation ON rag_embeddings
        FOR ALL
        USING (
          user_id::TEXT = current_setting('app.current_user_id', TRUE)
          OR
          EXISTS (
            SELECT 1 FROM users
            WHERE id::TEXT = current_setting('app.current_user_id', TRUE)
            AND role = 'admin'
          )
        )
    `;
    console.log('RLS habilitado');

    // 7. Verificar
    const check = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'rag_embeddings'
    `;

    if (check.rows.length === 0) {
      throw new Error('La tabla no se creo correctamente');
    }

    console.log('Migracion pgvector completada');

    return res.status(200).json({
      success: true,
      message: 'Migracion pgvector ejecutada correctamente',
      components: {
        extension: 'vector',
        table: 'rag_embeddings',
        indexes: ['hnsw_vector', 'user_id', 'document_id'],
        functions: ['search_embeddings'],
        rls: true
      }
    });

  } catch (error: any) {
    console.error('Error en migracion pgvector:', error);
    return res.status(500).json({
      error: 'Error ejecutando migracion',
      message: error.message
    });
  }
}
