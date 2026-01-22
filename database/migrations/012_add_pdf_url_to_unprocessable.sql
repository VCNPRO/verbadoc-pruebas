/**
 * MIGRACIÓN 012: Añadir campo pdf_blob_url a unprocessable_documents
 *
 * Propósito: Guardar la URL del PDF para poder visualizarlo después
 */

-- =====================================================
-- 1. AÑADIR CAMPO pdf_blob_url
-- =====================================================

ALTER TABLE unprocessable_documents
ADD COLUMN IF NOT EXISTS pdf_blob_url TEXT;

COMMENT ON COLUMN unprocessable_documents.pdf_blob_url IS 'URL del PDF en Vercel Blob Storage';

-- =====================================================
-- 2. ACTUALIZAR FUNCIÓN add_unprocessable_document
-- =====================================================

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
  p_batch_id UUID DEFAULT NULL,
  p_pdf_blob_url TEXT DEFAULT NULL
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
    pdf_blob_url,
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
    p_pdf_blob_url,
    NOW()
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIN DE MIGRACIÓN 012
-- =====================================================
