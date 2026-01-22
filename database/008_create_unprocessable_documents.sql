-- Migration: 008_create_unprocessable_documents
-- Description: Creates table for unprocessable documents and helper function

-- Table: unprocessable_documents
CREATE TABLE IF NOT EXISTS unprocessable_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Assuming users table uses UUID, if not, adjust type
  filename VARCHAR(255) NOT NULL,
  rejection_category VARCHAR(100) NOT NULL, -- 'manual_anulado', 'manual_anulado_bulk', 'ocr_failed', etc.
  rejection_reason TEXT NOT NULL,
  extracted_data JSONB,
  numero_expediente VARCHAR(100),
  numero_accion VARCHAR(100),
  numero_grupo VARCHAR(100),
  file_hash VARCHAR(64),
  batch_id UUID,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  can_retry BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_unprocessable_user_id ON unprocessable_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_unprocessable_category ON unprocessable_documents(rejection_category);

-- Function: add_unprocessable_document
CREATE OR REPLACE FUNCTION add_unprocessable_document(
  p_user_id UUID,
  p_filename VARCHAR,
  p_category VARCHAR,
  p_reason TEXT,
  p_extracted_data JSONB DEFAULT NULL,
  p_numero_expediente VARCHAR DEFAULT NULL,
  p_numero_accion VARCHAR DEFAULT NULL,
  p_numero_grupo VARCHAR DEFAULT NULL,
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
    batch_id
  ) VALUES (
    p_user_id,
    p_filename,
    p_category,
    p_reason,
    p_extracted_data,
    p_numero_expediente,
    p_numero_accion,
    p_numero_grupo,
    p_file_hash,
    p_batch_id
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;
