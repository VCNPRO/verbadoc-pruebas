-- ============================================================================
-- MIGRACIÓN 004: Almacenamiento de PDFs en Vercel Blob
-- ============================================================================
-- Fecha: 2026-01-09
-- Propósito: Guardar PDFs originales para auditoría y trazabilidad
-- Requisito: ENS op.pl.1 (Protección de la información)
-- ============================================================================

-- ============================================================================
-- 1. AÑADIR COLUMNAS PARA BLOB STORAGE
-- ============================================================================

-- Añadir columnas a extraction_results
ALTER TABLE extraction_results
ADD COLUMN IF NOT EXISTS pdf_blob_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_blob_pathname TEXT,
ADD COLUMN IF NOT EXISTS pdf_stored_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS pdf_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS pdf_checksum VARCHAR(64); -- SHA-256

-- Comentarios para documentación
COMMENT ON COLUMN extraction_results.pdf_blob_url IS 'URL pública del PDF en Vercel Blob';
COMMENT ON COLUMN extraction_results.pdf_blob_pathname IS 'Pathname único en Vercel Blob';
COMMENT ON COLUMN extraction_results.pdf_stored_at IS 'Timestamp de cuándo se subió el PDF';
COMMENT ON COLUMN extraction_results.pdf_size_bytes IS 'Tamaño del PDF en bytes';
COMMENT ON COLUMN extraction_results.pdf_checksum IS 'SHA-256 checksum para verificar integridad';

-- ============================================================================
-- 2. ÍNDICES
-- ============================================================================

-- Índice para búsquedas por pathname
CREATE INDEX IF NOT EXISTS idx_extraction_results_pdf_pathname
ON extraction_results(pdf_blob_pathname)
WHERE pdf_blob_pathname IS NOT NULL;

-- Índice para búsquedas por fecha de almacenamiento
CREATE INDEX IF NOT EXISTS idx_extraction_results_pdf_stored
ON extraction_results(pdf_stored_at DESC)
WHERE pdf_stored_at IS NOT NULL;

-- ============================================================================
-- 3. FUNCIÓN HELPER PARA LIMPIEZA DE BLOBS HUÉRFANOS
-- ============================================================================

/**
 * Función para identificar blobs huérfanos (PDFs subidos pero sin extracción)
 * Útil para limpieza periódica y ahorro de costes
 */
CREATE OR REPLACE FUNCTION find_orphan_blobs(older_than_days INTEGER DEFAULT 7)
RETURNS TABLE (
  extraction_id UUID,
  pdf_blob_pathname TEXT,
  pdf_stored_at TIMESTAMP,
  days_old INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    er.id as extraction_id,
    er.pdf_blob_pathname,
    er.pdf_stored_at,
    EXTRACT(DAY FROM NOW() - er.pdf_stored_at)::INTEGER as days_old
  FROM extraction_results er
  WHERE er.pdf_blob_pathname IS NOT NULL
  AND er.pdf_stored_at < NOW() - (older_than_days || ' days')::INTERVAL
  AND er.status IN ('failed', 'error') -- Solo blobs de extracciones fallidas
  ORDER BY er.pdf_stored_at ASC;
END;
$$;

/**
 * Función para obtener estadísticas de almacenamiento
 */
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
  total_pdfs_stored BIGINT,
  total_size_bytes BIGINT,
  total_size_mb NUMERIC,
  total_size_gb NUMERIC,
  avg_pdf_size_mb NUMERIC,
  oldest_pdf TIMESTAMP,
  newest_pdf TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE pdf_blob_url IS NOT NULL)::BIGINT as total_pdfs_stored,
    SUM(pdf_size_bytes)::BIGINT as total_size_bytes,
    ROUND((SUM(pdf_size_bytes) / 1024.0 / 1024.0)::NUMERIC, 2) as total_size_mb,
    ROUND((SUM(pdf_size_bytes) / 1024.0 / 1024.0 / 1024.0)::NUMERIC, 2) as total_size_gb,
    ROUND((AVG(pdf_size_bytes) / 1024.0 / 1024.0)::NUMERIC, 2) as avg_pdf_size_mb,
    MIN(pdf_stored_at) as oldest_pdf,
    MAX(pdf_stored_at) as newest_pdf
  FROM extraction_results
  WHERE pdf_blob_url IS NOT NULL;
END;
$$;

-- ============================================================================
-- 4. VISTA ÚTIL
-- ============================================================================

-- Vista: Extracciones con información de almacenamiento
CREATE OR REPLACE VIEW extractions_with_storage AS
SELECT
  er.id,
  er.user_id,
  er.filename,
  er.status,
  er.created_at,
  er.pdf_blob_url IS NOT NULL as has_pdf_stored,
  er.pdf_blob_url,
  er.pdf_stored_at,
  ROUND((er.pdf_size_bytes / 1024.0 / 1024.0)::NUMERIC, 2) as pdf_size_mb,
  er.pdf_checksum,
  EXTRACT(DAY FROM NOW() - er.pdf_stored_at)::INTEGER as days_stored
FROM extraction_results er
ORDER BY er.created_at DESC;

-- ============================================================================
-- 5. TESTING
-- ============================================================================

-- Test 1: Verificar columnas añadidas
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'extraction_results'
AND column_name LIKE 'pdf_%';

-- Test 2: Verificar función de estadísticas
SELECT * FROM get_storage_stats();

-- Test 3: Simular inserción con blob
-- (Solo para testing - en producción se hace desde el endpoint)
/*
UPDATE extraction_results
SET
  pdf_blob_url = 'https://blob.vercel-storage.com/test-abc123.pdf',
  pdf_blob_pathname = 'pdfs/2026/01/test-abc123.pdf',
  pdf_stored_at = NOW(),
  pdf_size_bytes = 1024000,
  pdf_checksum = 'abc123def456'
WHERE id = (SELECT id FROM extraction_results LIMIT 1);

-- Verificar
SELECT * FROM extractions_with_storage WHERE has_pdf_stored = TRUE;

-- Limpiar test
UPDATE extraction_results
SET
  pdf_blob_url = NULL,
  pdf_blob_pathname = NULL,
  pdf_stored_at = NULL,
  pdf_size_bytes = NULL,
  pdf_checksum = NULL
WHERE pdf_blob_pathname = 'pdfs/2026/01/test-abc123.pdf';
*/

-- ============================================================================
-- ROLLBACK (Si necesitas revertir)
-- ============================================================================

-- DROP VIEW IF EXISTS extractions_with_storage;
-- DROP FUNCTION IF EXISTS get_storage_stats();
-- DROP FUNCTION IF EXISTS find_orphan_blobs(INTEGER);
-- DROP INDEX IF EXISTS idx_extraction_results_pdf_pathname;
-- DROP INDEX IF EXISTS idx_extraction_results_pdf_stored;
-- ALTER TABLE extraction_results DROP COLUMN IF EXISTS pdf_blob_url;
-- ALTER TABLE extraction_results DROP COLUMN IF EXISTS pdf_blob_pathname;
-- ALTER TABLE extraction_results DROP COLUMN IF EXISTS pdf_stored_at;
-- ALTER TABLE extraction_results DROP COLUMN IF EXISTS pdf_size_bytes;
-- ALTER TABLE extraction_results DROP COLUMN IF EXISTS pdf_checksum;

-- ============================================================================
-- FIN DE MIGRACIÓN 004
-- ============================================================================
