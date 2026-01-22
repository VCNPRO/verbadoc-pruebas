/**
 * Migración 006: Detección de Tipo de PDF
 *
 * Añade campos para almacenar información sobre el tipo de PDF:
 * - Si contiene texto extraíble (OCR/nativo)
 * - Si es solo imágenes (PDF escaneado)
 * - Estadísticas de análisis
 */

-- ============================================================================
-- 1. AGREGAR COLUMNAS PARA TIPO DE PDF
-- ============================================================================

-- Añadir columnas a extraction_results
DO $$
BEGIN
  -- Tipo de PDF: 'ocr', 'image', 'mixed', 'unknown'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_type'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_type VARCHAR(20) DEFAULT 'unknown';

    COMMENT ON COLUMN extraction_results.pdf_type IS 'Tipo de PDF detectado: ocr (con texto), image (solo imágenes), mixed (mixto), unknown (desconocido)';
  END IF;

  -- Si el PDF tiene texto extraíble
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_has_text'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_has_text BOOLEAN DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_has_text IS 'Indica si el PDF contiene texto extraíble';
  END IF;

  -- Número total de páginas del PDF
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_page_count'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_page_count INTEGER DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_page_count IS 'Número total de páginas en el PDF';
  END IF;

  -- Páginas con texto
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_text_pages'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_text_pages INTEGER DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_text_pages IS 'Número de páginas con texto extraíble';
  END IF;

  -- Muestra del contenido de texto
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_text_sample'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_text_sample TEXT DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_text_sample IS 'Muestra de texto extraído del PDF (primeros 200 caracteres)';
  END IF;

  -- Confianza en la detección
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_detection_confidence'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_detection_confidence VARCHAR(10) DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_detection_confidence IS 'Nivel de confianza en la detección: high, medium, low';
  END IF;

  -- Fecha de análisis del PDF
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_analyzed_at'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_analyzed_at TIMESTAMP DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_analyzed_at IS 'Fecha y hora en que se analizó el tipo de PDF';
  END IF;

  -- Detalles adicionales del análisis
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_analysis_details'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_analysis_details TEXT DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_analysis_details IS 'Detalles adicionales del análisis de tipo de PDF';
  END IF;

  -- Si el PDF requiere OCR
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_results'
    AND column_name = 'pdf_requires_ocr'
  ) THEN
    ALTER TABLE extraction_results
    ADD COLUMN pdf_requires_ocr BOOLEAN DEFAULT NULL;

    COMMENT ON COLUMN extraction_results.pdf_requires_ocr IS 'Indica si el PDF requiere procesamiento OCR';
  END IF;

END $$;

-- ============================================================================
-- 2. ÍNDICES PARA BÚSQUEDAS
-- ============================================================================

-- Índice para buscar PDFs por tipo
CREATE INDEX IF NOT EXISTS idx_extraction_results_pdf_type
ON extraction_results(pdf_type)
WHERE pdf_type IS NOT NULL;

-- Índice para buscar PDFs que requieren OCR
CREATE INDEX IF NOT EXISTS idx_extraction_results_requires_ocr
ON extraction_results(pdf_requires_ocr)
WHERE pdf_requires_ocr = TRUE;

-- Índice para buscar PDFs con/sin texto
CREATE INDEX IF NOT EXISTS idx_extraction_results_has_text
ON extraction_results(pdf_has_text)
WHERE pdf_has_text IS NOT NULL;

-- ============================================================================
-- 3. FUNCIÓN PARA OBTENER ESTADÍSTICAS DE TIPOS DE PDF
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pdf_type_statistics(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  pdf_type VARCHAR,
  count BIGINT,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    er.pdf_type,
    COUNT(*)::BIGINT as count,
    ROUND(
      COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0),
      2
    ) as percentage
  FROM extraction_results er
  WHERE
    (p_user_id IS NULL OR er.user_id = p_user_id)
    AND er.pdf_type IS NOT NULL
  GROUP BY er.pdf_type
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pdf_type_statistics IS 'Obtiene estadísticas de tipos de PDF procesados (global o por usuario)';

-- ============================================================================
-- 4. FUNCIÓN PARA OBTENER PDFs QUE REQUIEREN OCR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pdfs_requiring_ocr(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  filename VARCHAR,
  pdf_type VARCHAR,
  page_count INTEGER,
  text_pages INTEGER,
  uploaded_at TIMESTAMP,
  pdf_blob_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    er.id,
    er.filename,
    er.pdf_type,
    er.pdf_page_count,
    er.pdf_text_pages,
    er.created_at,
    er.pdf_blob_url
  FROM extraction_results er
  WHERE
    (p_user_id IS NULL OR er.user_id = p_user_id)
    AND er.pdf_requires_ocr = TRUE
    AND er.pdf_blob_url IS NOT NULL
  ORDER BY er.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pdfs_requiring_ocr IS 'Obtiene lista de PDFs que requieren procesamiento OCR';

-- ============================================================================
-- 5. VISTA: PDFs con Análisis Completo
-- ============================================================================

CREATE OR REPLACE VIEW v_pdfs_analyzed AS
SELECT
  er.id,
  er.user_id,
  er.filename,
  er.pdf_type,
  er.pdf_has_text,
  er.pdf_page_count,
  er.pdf_text_pages,
  CASE
    WHEN er.pdf_page_count > 0 AND er.pdf_text_pages IS NOT NULL THEN
      ROUND((er.pdf_text_pages::NUMERIC / er.pdf_page_count::NUMERIC) * 100, 2)
    ELSE NULL
  END as text_coverage_percentage,
  er.pdf_requires_ocr,
  er.pdf_detection_confidence,
  er.pdf_analyzed_at,
  er.pdf_blob_url,
  er.pdf_size_bytes,
  er.created_at,
  u.email as user_email
FROM extraction_results er
LEFT JOIN users u ON er.user_id = u.id
WHERE
  er.pdf_type IS NOT NULL
  AND er.pdf_analyzed_at IS NOT NULL;

COMMENT ON VIEW v_pdfs_analyzed IS 'Vista de PDFs con análisis de tipo completo';

-- ============================================================================
-- 6. POLÍTICA RLS PARA NUEVA VISTA
-- ============================================================================

-- Habilitar RLS en la vista (hereda permisos de extraction_results)
ALTER VIEW v_pdfs_analyzed SET (security_invoker = on);

-- ============================================================================
-- FIN DE MIGRACIÓN 006
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migración 006 completada exitosamente';
  RAISE NOTICE '   - Añadidas 9 columnas para detección de tipo de PDF';
  RAISE NOTICE '   - Creados 3 índices para búsquedas optimizadas';
  RAISE NOTICE '   - Creadas 2 funciones PL/pgSQL';
  RAISE NOTICE '   - Creada 1 vista v_pdfs_analyzed';
END $$;
