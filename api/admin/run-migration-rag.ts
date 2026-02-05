/**
 * API ENDPOINT: /api/admin/run-migration-rag
 * Ejecuta la migracion para tablas RAG: rag_queries y rag_document_chunks
 *
 * IMPORTANTE: Solo accesible por admin
 * Cumplimiento RGPD/ENS: Tablas de auditoria para consultas semanticas
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// Helper: Verificar autenticacion de admin
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

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  // Verificar que es admin
  if (!verifyAdminAuth(req)) {
    return res.status(403).json({ error: 'Solo administradores pueden ejecutar migraciones' });
  }

  try {
    console.log('Ejecutando migracion RAG: rag_queries y rag_document_chunks');

    // =====================================================
    // 1. CREAR TABLA rag_queries (Auditoria de consultas)
    // =====================================================
    await sql`
      CREATE TABLE IF NOT EXISTS rag_queries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Usuario que realizo la consulta
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Consulta y respuesta
        query TEXT NOT NULL,
        response TEXT,

        -- Documentos consultados (array de UUIDs)
        document_ids UUID[],

        -- Metricas
        confidence_score DECIMAL(3,2),
        processing_time_ms INTEGER,
        tokens_used INTEGER,

        -- Informacion de acceso (RGPD/ENS)
        ip_address INET,
        user_agent TEXT,

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('Tabla rag_queries creada');

    // =====================================================
    // 2. CREAR TABLA rag_document_chunks
    // =====================================================
    await sql`
      CREATE TABLE IF NOT EXISTS rag_document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Referencia al documento original
        document_id UUID NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,

        -- Informacion del chunk
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,

        -- Referencia a Pinecone
        pinecone_id VARCHAR(255) NOT NULL,

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),

        -- Constraint: Un documento solo puede tener un chunk por indice
        UNIQUE(document_id, chunk_index)
      )
    `;
    console.log('Tabla rag_document_chunks creada');

    // =====================================================
    // 3. CREAR INDICES PARA rag_queries
    // =====================================================
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_queries_user ON rag_queries(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_queries_created ON rag_queries(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_queries_confidence ON rag_queries(confidence_score)`;
    console.log('3 indices creados para rag_queries');

    // =====================================================
    // 4. CREAR INDICES PARA rag_document_chunks
    // =====================================================
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_document_chunks(document_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rag_chunks_pinecone ON rag_document_chunks(pinecone_id)`;
    console.log('2 indices creados para rag_document_chunks');

    // =====================================================
    // 5. CREAR FUNCION PARA ESTADISTICAS RAG
    // =====================================================
    await sql`
      CREATE OR REPLACE FUNCTION get_rag_stats(
        p_user_id UUID DEFAULT NULL,
        p_days INTEGER DEFAULT 30
      ) RETURNS TABLE (
        total_queries BIGINT,
        avg_confidence DECIMAL(3,2),
        total_documents_indexed BIGINT,
        total_chunks BIGINT,
        queries_last_period BIGINT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          (SELECT COUNT(*) FROM rag_queries WHERE (p_user_id IS NULL OR user_id = p_user_id))::BIGINT,
          (SELECT COALESCE(AVG(confidence_score), 0) FROM rag_queries WHERE (p_user_id IS NULL OR user_id = p_user_id))::DECIMAL(3,2),
          (SELECT COUNT(DISTINCT document_id) FROM rag_document_chunks)::BIGINT,
          (SELECT COUNT(*) FROM rag_document_chunks)::BIGINT,
          (SELECT COUNT(*) FROM rag_queries WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL AND (p_user_id IS NULL OR user_id = p_user_id))::BIGINT;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('Funcion get_rag_stats creada');

    // =====================================================
    // 6. CREAR FUNCION PARA LIMPIAR CONSULTAS ANTIGUAS
    // =====================================================
    await sql`
      CREATE OR REPLACE FUNCTION cleanup_old_rag_queries(
        p_retention_days INTEGER DEFAULT 730  -- 2 anos por defecto (ENS)
      ) RETURNS INTEGER AS $$
      DECLARE
        v_deleted INTEGER;
      BEGIN
        DELETE FROM rag_queries
        WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;

        GET DIAGNOSTICS v_deleted = ROW_COUNT;
        RETURN v_deleted;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('Funcion cleanup_old_rag_queries creada');

    // =====================================================
    // 7. HABILITAR RLS PARA rag_queries
    // =====================================================
    await sql`ALTER TABLE rag_queries ENABLE ROW LEVEL SECURITY`;

    await sql`
      DROP POLICY IF EXISTS rag_queries_user_isolation ON rag_queries
    `;

    await sql`
      CREATE POLICY rag_queries_user_isolation ON rag_queries
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
    console.log('RLS habilitado para rag_queries');

    // =====================================================
    // 8. HABILITAR RLS PARA rag_document_chunks
    // =====================================================
    await sql`ALTER TABLE rag_document_chunks ENABLE ROW LEVEL SECURITY`;

    await sql`
      DROP POLICY IF EXISTS rag_chunks_user_isolation ON rag_document_chunks
    `;

    await sql`
      CREATE POLICY rag_chunks_user_isolation ON rag_document_chunks
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM extraction_results er
            WHERE er.id = rag_document_chunks.document_id
            AND (
              er.user_id::TEXT = current_setting('app.current_user_id', TRUE)
              OR
              EXISTS (
                SELECT 1 FROM users
                WHERE id::TEXT = current_setting('app.current_user_id', TRUE)
                AND role = 'admin'
              )
            )
          )
        )
    `;
    console.log('RLS habilitado para rag_document_chunks');

    // =====================================================
    // 9. VERIFICAR TABLAS CREADAS
    // =====================================================
    const checkQueries = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'rag_queries'
    `;

    const checkChunks = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'rag_document_chunks'
    `;

    if (checkQueries.rows.length === 0 || checkChunks.rows.length === 0) {
      throw new Error('Las tablas RAG no se crearon correctamente');
    }

    console.log('Migracion RAG completada exitosamente');

    return res.status(200).json({
      success: true,
      message: 'Migracion RAG ejecutada correctamente',
      tables: ['rag_queries', 'rag_document_chunks'],
      components: {
        tables: 2,
        indices: 5,
        functions: 2,
        rls_policies: 2
      },
      compliance: {
        rgpd: true,
        ens: true,
        retention_days: 730
      }
    });

  } catch (error: any) {
    console.error('Error en migracion RAG:', error);
    return res.status(500).json({
      error: 'Error ejecutando migracion',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
