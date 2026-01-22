/**
 * MIGRACIÓN 009: Tabla de Documentos No Procesables
 *
 * Propósito: Rastrear archivos que no pueden ser procesados
 * Razones: sin_referencia, ilegible, incompleto, duplicado, error_critico
 */

-- =====================================================
-- 1. TABLA PRINCIPAL: unprocessable_documents
-- =====================================================

CREATE TABLE IF NOT EXISTS unprocessable_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación del archivo
  filename VARCHAR(500) NOT NULL,
  file_hash VARCHAR(64), -- SHA256 para detectar duplicados
  file_size_bytes INTEGER,
  file_type VARCHAR(100),

  -- Información del batch (si aplica)
  batch_id UUID, -- References removed until batch system is fully implemented
  batch_item_id UUID,

  -- Usuario que intentó procesar
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Razón del rechazo
  rejection_category VARCHAR(50) NOT NULL CHECK (rejection_category IN (
    'sin_referencia',     -- No existe en Excel de referencia
    'campos_faltantes',   -- Faltan expediente, acción o grupo
    'ilegible',          -- OCR no pudo leer el documento
    'incompleto',        -- Faltan campos críticos
    'duplicado',         -- Ya fue procesado antes
    'error_critico',     -- Error técnico al procesar
    'formato_invalido',  -- Formato de archivo no soportado
    'manual_anulado'     -- Anulado manualmente en review
  )),

  rejection_reason TEXT, -- Descripción detallada del rechazo

  -- Datos extraídos (si se logró extraer algo antes del rechazo)
  extracted_data JSONB,

  -- Campos clave que se intentaron validar
  numero_expediente VARCHAR(50),
  numero_accion VARCHAR(50),
  numero_grupo VARCHAR(50),

  -- Intentos de procesamiento
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  can_retry BOOLEAN DEFAULT false,
  last_attempt_at TIMESTAMP,

  -- Localización del archivo (si se guardó localmente)
  local_path VARCHAR(1000), -- /no_procesables/{categoria}/{filename}

  -- Metadata adicional
  metadata JSONB, -- Información extra del error, logs, etc

  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT
);

-- =====================================================
-- 2. ÍNDICES PARA BÚSQUEDAS RÁPIDAS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_unprocessable_user ON unprocessable_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_unprocessable_batch ON unprocessable_documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_unprocessable_category ON unprocessable_documents(rejection_category);
CREATE INDEX IF NOT EXISTS idx_unprocessable_hash ON unprocessable_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_unprocessable_created ON unprocessable_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unprocessable_expediente ON unprocessable_documents(numero_expediente);

-- Índice compuesto para búsqueda por campos clave
CREATE INDEX IF NOT EXISTS idx_unprocessable_key_fields ON unprocessable_documents(numero_expediente, numero_accion, numero_grupo);

-- =====================================================
-- 3. TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_unprocessable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unprocessable_updated_at ON unprocessable_documents;

CREATE TRIGGER trg_unprocessable_updated_at
  BEFORE UPDATE ON unprocessable_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_unprocessable_updated_at();

-- =====================================================
-- 4. FUNCIONES AUXILIARES
-- =====================================================

-- Función: Registrar documento no procesable
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
    user_id,
    filename,
    rejection_category,
    rejection_reason,
    extracted_data,
    numero_expediente,
    numero_accion,
    numero_grupo,
    file_hash,
    batch_id,
    last_attempt_at
  ) VALUES (
    p_user_id,
    p_filename,
    p_category,
    p_reason,
    p_extracted_data,
    p_expediente,
    p_accion,
    p_grupo,
    p_file_hash,
    p_batch_id,
    NOW()
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Función: Verificar si un archivo ya fue marcado como no procesable
CREATE OR REPLACE FUNCTION is_already_unprocessable(
  p_file_hash VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM unprocessable_documents
    WHERE file_hash = p_file_hash
    AND created_at > NOW() - INTERVAL '30 days' -- Solo últimos 30 días
  );
END;
$$ LANGUAGE plpgsql;

-- Función: Marcar para reintento
CREATE OR REPLACE FUNCTION mark_for_retry(
  p_document_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_retry_count INTEGER;
  v_max_retries INTEGER;
BEGIN
  SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
  FROM unprocessable_documents
  WHERE id = p_document_id;

  IF v_retry_count < v_max_retries THEN
    UPDATE unprocessable_documents
    SET retry_count = retry_count + 1,
        can_retry = true,
        last_attempt_at = NOW()
    WHERE id = p_document_id;

    RETURN true;
  ELSE
    RETURN false; -- Ya alcanzó máximo de reintentos
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Función: Obtener estadísticas de no procesables
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE unprocessable_documents ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios ven solo sus documentos no procesables
DROP POLICY IF EXISTS unprocessable_user_isolation ON unprocessable_documents;

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
  );

-- =====================================================
-- 6. VISTA CONSOLIDADA
-- =====================================================

CREATE OR REPLACE VIEW v_unprocessable_documents_detailed AS
SELECT
  u.id,
  u.filename,
  u.rejection_category,
  u.rejection_reason,
  u.numero_expediente,
  u.numero_accion,
  u.numero_grupo,
  u.retry_count,
  u.max_retries,
  u.can_retry,
  u.created_at,
  u.updated_at,
  u.reviewed_at,

  -- Info del usuario
  users.email as user_email,
  users.name as user_name,

  -- Info del revisor (si fue revisado)
  reviewer.email as reviewer_email,
  reviewer.name as reviewer_name

FROM unprocessable_documents u
LEFT JOIN users ON u.user_id = users.id
LEFT JOIN users reviewer ON u.reviewed_by = reviewer.id
ORDER BY u.created_at DESC;

-- =====================================================
-- 7. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE unprocessable_documents IS 'Documentos que no pueden ser procesados y sus razones';
COMMENT ON COLUMN unprocessable_documents.rejection_category IS 'Categoría del rechazo: sin_referencia, ilegible, incompleto, etc';
COMMENT ON COLUMN unprocessable_documents.file_hash IS 'Hash SHA256 del archivo para detectar duplicados';
COMMENT ON COLUMN unprocessable_documents.can_retry IS 'Indica si el documento puede ser reprocesado';
COMMENT ON COLUMN unprocessable_documents.local_path IS 'Ruta local donde se guardó el archivo: /no_procesables/{categoria}/{filename}';

-- =====================================================
-- 8. DATOS DE EJEMPLO PARA TESTING
-- =====================================================

-- (Se omiten en producción, solo para desarrollo)
-- INSERT INTO unprocessable_documents (user_id, filename, rejection_category, rejection_reason)
-- VALUES
--   ('user-uuid', 'test_sin_referencia.pdf', 'sin_referencia', 'Expediente ABC123 no existe en reference_data'),
--   ('user-uuid', 'test_ilegible.pdf', 'ilegible', 'OCR no pudo extraer texto del documento escaneado');

-- =====================================================
-- FIN DE MIGRACIÓN 009
-- =====================================================
