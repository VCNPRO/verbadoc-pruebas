/**
 * API ENDPOINT: /api/admin/run-migration-009
 * Ejecuta la migración 009: tabla unprocessable_documents
 *
 * IMPORTANTE: Solo accesible por admin
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// Helper: Verificar autenticación de admin
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
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar que es admin
  if (!verifyAdminAuth(req)) {
    return res.status(403).json({ error: 'Solo administradores pueden ejecutar migraciones' });
  }

  try {
    console.log('🚀 Ejecutando migración 009: unprocessable_documents');

    // =====================================================
    // 1. CREAR TABLA
    // =====================================================
    await sql`
      CREATE TABLE IF NOT EXISTS unprocessable_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Identificación del archivo
        filename VARCHAR(500) NOT NULL,
        file_hash VARCHAR(64),
        file_size_bytes INTEGER,
        file_type VARCHAR(100),

        -- Información del batch
        batch_id UUID,
        batch_item_id UUID,

        -- Usuario que intentó procesar
        user_id UUID,

        -- Razón del rechazo
        rejection_category VARCHAR(50) NOT NULL CHECK (rejection_category IN (
          'sin_referencia', 'campos_faltantes', 'ilegible', 'incompleto',
          'duplicado', 'error_critico', 'formato_invalido', 'manual_anulado'
        )),

        rejection_reason TEXT,

        -- Datos extraídos
        extracted_data JSONB,

        -- Campos clave
        numero_expediente VARCHAR(50),
        numero_accion VARCHAR(50),
        numero_grupo VARCHAR(50),

        -- Intentos
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        can_retry BOOLEAN DEFAULT false,
        last_attempt_at TIMESTAMP,

        -- Localización
        local_path VARCHAR(1000),

        -- Metadata
        metadata JSONB,

        -- Auditoría
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        reviewed_by UUID,
        reviewed_at TIMESTAMP,
        review_notes TEXT
      )
    `;
    console.log('✅ Tabla unprocessable_documents creada');

    // =====================================================
    // 2. CREAR ÍNDICES
    // =====================================================
    await sql`CREATE INDEX IF NOT EXISTS idx_unprocessable_user ON unprocessable_documents(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unprocessable_batch ON unprocessable_documents(batch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unprocessable_category ON unprocessable_documents(rejection_category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unprocessable_hash ON unprocessable_documents(file_hash)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unprocessable_created ON unprocessable_documents(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unprocessable_expediente ON unprocessable_documents(numero_expediente)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unprocessable_key_fields ON unprocessable_documents(numero_expediente, numero_accion, numero_grupo)`;
    console.log('✅ 7 índices creados');

    // =====================================================
    // 3. TRIGGER
    // =====================================================
    await sql`
      CREATE OR REPLACE FUNCTION update_unprocessable_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`
      DROP TRIGGER IF EXISTS trg_unprocessable_updated_at ON unprocessable_documents
    `;

    await sql`
      CREATE TRIGGER trg_unprocessable_updated_at
        BEFORE UPDATE ON unprocessable_documents
        FOR EACH ROW
        EXECUTE FUNCTION update_unprocessable_updated_at()
    `;
    console.log('✅ Trigger creado');

    // =====================================================
    // 4. FUNCIONES
    // =====================================================
    await sql`
      CREATE OR REPLACE FUNCTION add_unprocessable_document(
        p_user_id UUID,
        p_filename VARCHAR,
        p_category VARCHAR,
        p_reason TEXT,
        p_extracted_data JSONB DEFAULT NULL,
        p_expediente VARCHAR DEFAULT NULL,
        p_accion VARCHAR DEFAULT NULL,
        p_grupo VARCHAR DEFAULT NULL,
        p_file_hash VARCHAR DEFAULT NULL,
        p_batch_id UUID DEFAULT NULL
      ) RETURNS UUID AS $$
      DECLARE
        v_new_id UUID;
      BEGIN
        INSERT INTO unprocessable_documents (
          user_id, filename, rejection_category, rejection_reason,
          extracted_data, numero_expediente, numero_accion, numero_grupo,
          file_hash, batch_id, last_attempt_at
        ) VALUES (
          p_user_id, p_filename, p_category, p_reason,
          p_extracted_data, p_expediente, p_accion, p_grupo,
          p_file_hash, p_batch_id, NOW()
        ) RETURNING id INTO v_new_id;

        RETURN v_new_id;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('✅ Función add_unprocessable_document creada');

    await sql`
      CREATE OR REPLACE FUNCTION get_unprocessable_stats(
        p_user_id UUID DEFAULT NULL
      ) RETURNS TABLE (
        category VARCHAR,
        count BIGINT,
        last_occurrence TIMESTAMP
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          rejection_category::VARCHAR,
          COUNT(*)::BIGINT,
          MAX(created_at)::TIMESTAMP
        FROM unprocessable_documents
        WHERE (p_user_id IS NULL OR user_id = p_user_id)
        GROUP BY rejection_category
        ORDER BY COUNT(*) DESC;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('✅ Función get_unprocessable_stats creada');

    // =====================================================
    // 5. RLS
    // =====================================================
    await sql`ALTER TABLE unprocessable_documents ENABLE ROW LEVEL SECURITY`;

    await sql`
      DROP POLICY IF EXISTS unprocessable_user_isolation ON unprocessable_documents
    `;

    await sql`
      CREATE POLICY unprocessable_user_isolation ON unprocessable_documents
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
    console.log('✅ RLS habilitado');

    // =====================================================
    // 6. VERIFICAR
    // =====================================================
    const check = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'unprocessable_documents'
    `;

    if (check.rows.length === 0) {
      throw new Error('La tabla no se creó correctamente');
    }

    console.log('✅ Migración 009 completada exitosamente');

    return res.status(200).json({
      success: true,
      message: 'Migración 009 ejecutada correctamente',
      table: 'unprocessable_documents',
      components: {
        indices: 7,
        functions: 2,
        triggers: 1,
        rls: true
      }
    });

  } catch (error: any) {
    console.error('❌ Error en migración 009:', error);
    return res.status(500).json({
      error: 'Error ejecutando migración',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
