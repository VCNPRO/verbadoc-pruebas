-- ============================================================================
-- MIGRACIÓN 005: Sistema de Procesamiento Batch
-- ============================================================================
-- Fecha: 2026-01-09
-- Propósito: Procesamiento paralelo de múltiples PDFs
-- Escalabilidad: Hasta 100 PDFs por batch
-- ============================================================================

-- ============================================================================
-- 1. TABLA DE BATCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_jobs (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Usuario que creó el batch
  user_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,

  -- Metadata
  name VARCHAR(255),
  description TEXT,

  -- Configuración
  model_used VARCHAR(50) DEFAULT 'gemini-2.5-flash',
  prompt_template TEXT,
  schema_config JSONB,

  -- Estadísticas
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  successful_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,

  -- Estado
  status VARCHAR(50) DEFAULT 'pending',
    -- 'pending', 'processing', 'completed', 'failed', 'cancelled'

  -- Tiempos
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  processing_time_ms BIGINT,

  -- Prioridad
  priority INTEGER DEFAULT 0, -- Mayor número = mayor prioridad

  -- Errores
  error_message TEXT
);

-- ============================================================================
-- 2. TABLA DE ITEMS DEL BATCH
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_items (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relación con batch
  batch_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE NOT NULL,

  -- Relación con extracción (si ya fue procesada)
  extraction_id UUID REFERENCES extraction_results(id) ON DELETE SET NULL,

  -- Archivo
  filename VARCHAR(500) NOT NULL,
  file_blob_url TEXT, -- URL del PDF en blob storage
  file_size_bytes BIGINT,

  -- Estado
  status VARCHAR(50) DEFAULT 'pending',
    -- 'pending', 'processing', 'completed', 'failed', 'skipped'

  -- Orden de procesamiento
  processing_order INTEGER,

  -- Resultado
  result_summary JSONB, -- Resumen del resultado de extracción
  validation_summary JSONB, -- Resumen de validación

  -- Tiempos
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  processing_time_ms INTEGER,

  -- Errores
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================

-- Índices en batch_jobs
CREATE INDEX idx_batch_jobs_user_id ON batch_jobs(user_id);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status, created_at DESC);
CREATE INDEX idx_batch_jobs_priority ON batch_jobs(priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Índices en batch_items
CREATE INDEX idx_batch_items_batch_id ON batch_items(batch_id);
CREATE INDEX idx_batch_items_extraction_id ON batch_items(extraction_id);
CREATE INDEX idx_batch_items_status ON batch_items(status);
CREATE INDEX idx_batch_items_processing_order ON batch_items(batch_id, processing_order);

-- Índice GIN para búsquedas en JSONB
CREATE INDEX idx_batch_items_result_gin ON batch_items USING GIN (result_summary);

-- ============================================================================
-- 4. FUNCIONES HELPER
-- ============================================================================

/**
 * Función para obtener estadísticas de un batch
 */
CREATE OR REPLACE FUNCTION get_batch_stats(p_batch_id UUID)
RETURNS TABLE (
  total_items BIGINT,
  pending BIGINT,
  processing BIGINT,
  completed BIGINT,
  failed BIGINT,
  completion_percentage NUMERIC,
  avg_processing_time_ms NUMERIC,
  estimated_time_remaining_ms BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_avg_time NUMERIC;
  v_pending_count BIGINT;
BEGIN
  -- Obtener estadísticas
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
      ELSE 0
    END,
    AVG(processing_time_ms)
  INTO
    total_items,
    pending,
    processing,
    completed,
    failed,
    completion_percentage,
    v_avg_time
  FROM batch_items
  WHERE batch_id = p_batch_id;

  -- Calcular tiempo estimado restante
  v_pending_count := pending + processing;

  IF v_avg_time IS NOT NULL AND v_avg_time > 0 AND v_pending_count > 0 THEN
    estimated_time_remaining_ms := (v_avg_time * v_pending_count)::BIGINT;
  ELSE
    estimated_time_remaining_ms := NULL;
  END IF;

  avg_processing_time_ms := ROUND(v_avg_time, 0);

  RETURN NEXT;
END;
$$;

/**
 * Función para obtener siguiente item a procesar
 */
CREATE OR REPLACE FUNCTION get_next_batch_item()
RETURNS TABLE (
  item_id UUID,
  batch_id UUID,
  filename VARCHAR,
  file_blob_url TEXT,
  model_used VARCHAR,
  prompt_template TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.id as item_id,
    bi.batch_id,
    bi.filename,
    bi.file_blob_url,
    bj.model_used,
    bj.prompt_template
  FROM batch_items bi
  INNER JOIN batch_jobs bj ON bi.batch_id = bj.id
  WHERE bi.status = 'pending'
  AND bj.status = 'processing'
  ORDER BY bj.priority DESC, bi.processing_order ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED; -- Evitar race conditions
END;
$$;

/**
 * Función para actualizar progreso del batch automáticamente
 */
CREATE OR REPLACE FUNCTION update_batch_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar contadores del batch
  UPDATE batch_jobs
  SET
    processed_files = (
      SELECT COUNT(*)
      FROM batch_items
      WHERE batch_id = NEW.batch_id
      AND status IN ('completed', 'failed')
    ),
    successful_files = (
      SELECT COUNT(*)
      FROM batch_items
      WHERE batch_id = NEW.batch_id
      AND status = 'completed'
    ),
    failed_files = (
      SELECT COUNT(*)
      FROM batch_items
      WHERE batch_id = NEW.batch_id
      AND status = 'failed'
    )
  WHERE id = NEW.batch_id;

  -- Si todos los items están procesados, marcar batch como completed
  UPDATE batch_jobs bj
  SET
    status = 'completed',
    completed_at = NOW(),
    processing_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
  WHERE id = NEW.batch_id
  AND NOT EXISTS (
    SELECT 1 FROM batch_items
    WHERE batch_id = NEW.batch_id
    AND status IN ('pending', 'processing')
  )
  AND bj.status = 'processing';

  RETURN NEW;
END;
$$;

-- Trigger para actualizar progreso automáticamente
CREATE TRIGGER trigger_update_batch_progress
  AFTER UPDATE ON batch_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_batch_progress();

-- ============================================================================
-- 5. ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items ENABLE ROW LEVEL SECURITY;

-- Políticas para batch_jobs
-- Usuarios ven solo sus propios batches
CREATE POLICY batch_jobs_select_own ON batch_jobs
  FOR SELECT
  USING (user_id = current_user_id() OR current_user_is_admin());

-- Solo usuarios autenticados pueden crear batches
CREATE POLICY batch_jobs_insert_authenticated ON batch_jobs
  FOR INSERT
  WITH CHECK (user_id = current_user_id());

-- Solo el owner puede actualizar su batch
CREATE POLICY batch_jobs_update_own ON batch_jobs
  FOR UPDATE
  USING (user_id = current_user_id() OR current_user_is_admin());

-- Solo el owner puede eliminar su batch
CREATE POLICY batch_jobs_delete_own ON batch_jobs
  FOR DELETE
  USING (user_id = current_user_id() OR current_user_is_admin());

-- Políticas para batch_items
-- Ver items de batches propios
CREATE POLICY batch_items_select_own ON batch_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM batch_jobs
      WHERE id = batch_id
      AND (user_id = current_user_id() OR current_user_is_admin())
    )
  );

-- Sistema puede insertar items
CREATE POLICY batch_items_insert_system ON batch_items
  FOR INSERT
  WITH CHECK (TRUE);

-- Sistema puede actualizar items
CREATE POLICY batch_items_update_system ON batch_items
  FOR UPDATE
  USING (TRUE);

-- Solo owner del batch puede eliminar items
CREATE POLICY batch_items_delete_own ON batch_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM batch_jobs
      WHERE id = batch_id
      AND (user_id = current_user_id() OR current_user_is_admin())
    )
  );

-- ============================================================================
-- 6. VISTAS ÚTILES
-- ============================================================================

-- Vista: Resumen de batches con progreso
CREATE OR REPLACE VIEW batch_jobs_summary AS
SELECT
  bj.id,
  bj.user_id,
  bj.name,
  bj.status,
  bj.total_files,
  bj.processed_files,
  bj.successful_files,
  bj.failed_files,
  CASE
    WHEN bj.total_files > 0 THEN
      ROUND((bj.processed_files::NUMERIC / bj.total_files::NUMERIC * 100), 2)
    ELSE 0
  END as completion_percentage,
  bj.created_at,
  bj.started_at,
  bj.completed_at,
  ROUND((bj.processing_time_ms / 1000.0), 2) as processing_time_seconds
FROM batch_jobs bj
ORDER BY bj.created_at DESC;

-- ============================================================================
-- 7. TESTING
-- ============================================================================

-- Test: Crear batch de prueba
INSERT INTO batch_jobs (
  user_id,
  name,
  description,
  model_used,
  total_files
) VALUES (
  (SELECT id FROM users LIMIT 1),
  'Batch de prueba',
  'Test de sistema batch',
  'gemini-2.5-flash',
  5
) RETURNING id;

-- Verificar creación
SELECT * FROM batch_jobs_summary WHERE name = 'Batch de prueba';

-- Limpiar test
DELETE FROM batch_jobs WHERE name = 'Batch de prueba';

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- DROP VIEW IF EXISTS batch_jobs_summary;
-- DROP TRIGGER IF EXISTS trigger_update_batch_progress ON batch_items;
-- DROP FUNCTION IF EXISTS update_batch_progress();
-- DROP FUNCTION IF EXISTS get_next_batch_item();
-- DROP FUNCTION IF EXISTS get_batch_stats(UUID);
-- DROP POLICY IF EXISTS batch_items_delete_own ON batch_items;
-- DROP POLICY IF EXISTS batch_items_update_system ON batch_items;
-- DROP POLICY IF EXISTS batch_items_insert_system ON batch_items;
-- DROP POLICY IF EXISTS batch_items_select_own ON batch_items;
-- DROP POLICY IF EXISTS batch_jobs_delete_own ON batch_jobs;
-- DROP POLICY IF EXISTS batch_jobs_update_own ON batch_jobs;
-- DROP POLICY IF EXISTS batch_jobs_insert_authenticated ON batch_jobs;
-- DROP POLICY IF EXISTS batch_jobs_select_own ON batch_jobs;
-- DROP TABLE IF EXISTS batch_items CASCADE;
-- DROP TABLE IF EXISTS batch_jobs CASCADE;

-- ============================================================================
-- FIN DE MIGRACIÓN 005
-- ============================================================================
