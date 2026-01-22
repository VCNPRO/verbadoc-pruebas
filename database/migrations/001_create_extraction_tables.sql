-- ============================================================================
-- MIGRACIÓN 001: Crear tablas para procesamiento de formularios FUNDAE
-- ============================================================================
-- Proyecto: verbadocpro
-- Fecha: 2026-01-08
-- Descripción: Tablas para almacenar extracciones, errores de validación y emails
-- ============================================================================

-- TABLA 1: extraction_results
-- Almacena todos los formularios procesados con sus datos extraídos
CREATE TABLE IF NOT EXISTS extraction_results (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Metadata del archivo
  filename VARCHAR(500) NOT NULL,
  file_url TEXT, -- URL en Vercel Blob Storage
  file_type VARCHAR(50), -- 'application/pdf', 'image/jpeg', etc.
  file_size_bytes INTEGER,
  page_count INTEGER DEFAULT 1,

  -- Datos extraídos (JSON flexible para cualquier esquema)
  extracted_data JSONB NOT NULL,

  -- Validación automática
  validation_status VARCHAR(50) DEFAULT 'pending',
  -- Valores: 'pending', 'valid', 'invalid', 'needs_review', 'approved', 'rejected'
  validation_errors_count INTEGER DEFAULT 0,

  -- Validación cruzada con Excel del cliente
  excel_validation_status VARCHAR(50),
  -- Valores: 'valid', 'rejected', 'not_found', 'not_checked'
  excel_matched_record JSONB, -- Registro del Excel maestro que coincide
  rejection_reason TEXT, -- Motivo de rechazo si excel_validation_status = 'rejected'

  -- Procesamiento con IA
  model_used VARCHAR(100), -- 'gemini-2.5-flash', 'gemini-2.5-pro', etc.
  processing_time_ms INTEGER,
  confidence_score DECIMAL(3,2), -- 0.00 a 1.00

  -- Correcciones manuales
  has_corrections BOOLEAN DEFAULT FALSE,
  corrected_by_user_id UUID,
  corrected_at TIMESTAMP,
  correction_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys (users table ya existe)
  CONSTRAINT fk_extraction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_extraction_corrector FOREIGN KEY (corrected_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_extraction_user_id ON extraction_results(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_validation_status ON extraction_results(validation_status);
CREATE INDEX IF NOT EXISTS idx_extraction_created_at ON extraction_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_needs_review ON extraction_results(validation_status)
  WHERE validation_status = 'needs_review';

-- Índice GIN para búsquedas en JSON (permite buscar dentro de extracted_data)
CREATE INDEX IF NOT EXISTS idx_extraction_data_gin ON extraction_results USING GIN (extracted_data);

-- ============================================================================

-- TABLA 2: validation_errors
-- Almacena errores individuales detectados en cada campo
CREATE TABLE IF NOT EXISTS validation_errors (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID NOT NULL,

  -- Detalles del error
  field_name VARCHAR(200) NOT NULL, -- 'cif', 'edad', 'valoracion.pregunta1', etc.
  error_type VARCHAR(100) NOT NULL,
  -- Tipos: 'invalid_format', 'out_of_range', 'multiple_answers', 'missing_required',
  --        'invalid_checksum', 'coherence_error', etc.
  error_message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'error', -- 'error', 'warning', 'info'

  -- Valor problemático
  invalid_value TEXT,
  expected_format TEXT,
  suggested_correction TEXT, -- Auto-corrección sugerida (ej: "NC" para múltiples respuestas)

  -- Posición en el documento (para resaltar en el PDF viewer)
  page_number INTEGER,
  field_position JSONB, -- {x: number, y: number, width: number, height: number}

  -- Resolución
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'fixed', 'ignored', 'auto_fixed'
  resolved_by_user_id UUID,
  resolved_at TIMESTAMP,
  corrected_value TEXT,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_validation_extraction FOREIGN KEY (extraction_id) REFERENCES extraction_results(id) ON DELETE CASCADE,
  CONSTRAINT fk_validation_resolver FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_validation_errors_extraction ON validation_errors(extraction_id);
CREATE INDEX IF NOT EXISTS idx_validation_errors_status ON validation_errors(status);
CREATE INDEX IF NOT EXISTS idx_validation_errors_type ON validation_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_validation_errors_severity ON validation_errors(severity);

-- ============================================================================

-- TABLA 3: email_notifications
-- Log de todos los emails enviados
CREATE TABLE IF NOT EXISTS email_notifications (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID, -- Nullable: algunos emails son resúmenes generales

  -- Detalles del email
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  notification_type VARCHAR(100) NOT NULL,
  -- Tipos: 'needs_review', 'batch_completed', 'daily_summary', 'error_alert', etc.

  -- Contenido (opcional, para debugging)
  email_body TEXT,

  -- Estado del envío
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP,
  error_message TEXT,

  -- Proveedor de email
  provider VARCHAR(50) DEFAULT 'resend', -- 'resend', 'sendgrid', 'ses', etc.
  provider_message_id VARCHAR(200), -- ID del mensaje del proveedor

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_notification_extraction FOREIGN KEY (extraction_id) REFERENCES extraction_results(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_extraction ON email_notifications(extraction_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created ON email_notifications(created_at DESC);

-- ============================================================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_extraction_results_updated_at BEFORE UPDATE ON extraction_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

-- Trigger para actualizar el contador de errores en extraction_results
CREATE OR REPLACE FUNCTION update_validation_errors_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE extraction_results
        SET validation_errors_count = validation_errors_count + 1
        WHERE id = NEW.extraction_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE extraction_results
        SET validation_errors_count = GREATEST(0, validation_errors_count - 1)
        WHERE id = OLD.extraction_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_errors_count_on_insert AFTER INSERT ON validation_errors
    FOR EACH ROW EXECUTE FUNCTION update_validation_errors_count();

CREATE TRIGGER update_errors_count_on_delete AFTER DELETE ON validation_errors
    FOR EACH ROW EXECUTE FUNCTION update_validation_errors_count();

-- ============================================================================

-- Comentarios en las tablas para documentación
COMMENT ON TABLE extraction_results IS 'Formularios FUNDAE procesados con IA';
COMMENT ON TABLE validation_errors IS 'Errores de validación detectados en cada formulario';
COMMENT ON TABLE email_notifications IS 'Log de emails enviados a clientes';

COMMENT ON COLUMN extraction_results.extracted_data IS 'JSON con todos los datos extraídos del formulario';
COMMENT ON COLUMN extraction_results.validation_status IS 'Estado: pending, valid, invalid, needs_review, approved, rejected';
COMMENT ON COLUMN validation_errors.error_type IS 'Tipo de error: invalid_format, out_of_range, multiple_answers, etc.';
COMMENT ON COLUMN validation_errors.suggested_correction IS 'Corrección automática sugerida (ej: NC para múltiples respuestas)';

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
