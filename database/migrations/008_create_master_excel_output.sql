-- ============================================================================
-- MIGRACIÓN 008: EXCEL MASTER DE SALIDA
-- ============================================================================
-- Fecha: 2026-01-11
-- Descripción: Tabla para almacenar el Excel master con todos los formularios procesados
--              Permite trabajar desde múltiples dispositivos y acceder al Excel desde la app
-- ============================================================================

-- ============================================================================
-- 1. TABLA: master_excel_output
-- ============================================================================
-- Almacena cada fila del Excel de salida (un formulario = una fila)

CREATE TABLE IF NOT EXISTS master_excel_output (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  extraction_id UUID REFERENCES extraction_results(id) ON DELETE CASCADE,

  -- Datos de la fila (campos FUNDAE mapeados)
  row_data JSONB NOT NULL,
  -- Formato: {
  --   "expediente": "B241889AC",
  --   "cif": "A28122125",
  --   "denominacion_aaff": "...",
  --   "edad": 35,
  --   "sexo": "Hombre",
  --   ... todos los campos del formulario
  -- }

  -- Metadata de la fila
  row_number INTEGER, -- Número de fila en el Excel (para ordenar)
  filename VARCHAR(500), -- PDF original del que viene

  -- Estado de validación
  validation_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'valid', 'needs_review', 'approved', 'rejected'

  cross_validation_match BOOLEAN DEFAULT false, -- ¿Coincide con Excel de referencia?
  discrepancy_count INTEGER DEFAULT 0, -- Número de discrepancias encontradas

  -- Control de versiones
  is_latest BOOLEAN DEFAULT true, -- Si es la última versión de esta fila
  version INTEGER DEFAULT 1, -- Número de versión (si se corrige, incrementa)
  superseded_by UUID REFERENCES master_excel_output(id), -- Si hay una versión más nueva

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_master_excel_user_id ON master_excel_output(user_id);
CREATE INDEX IF NOT EXISTS idx_master_excel_extraction_id ON master_excel_output(extraction_id);
CREATE INDEX IF NOT EXISTS idx_master_excel_row_number ON master_excel_output(row_number);
CREATE INDEX IF NOT EXISTS idx_master_excel_validation_status ON master_excel_output(validation_status);
CREATE INDEX IF NOT EXISTS idx_master_excel_is_latest ON master_excel_output(is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_master_excel_created_at ON master_excel_output(created_at DESC);

-- Índice GIN para búsquedas en JSON
CREATE INDEX IF NOT EXISTS idx_master_excel_row_data ON master_excel_output USING GIN (row_data);

-- RLS: Los usuarios solo ven sus propias filas
ALTER TABLE master_excel_output ENABLE ROW LEVEL SECURITY;

CREATE POLICY master_excel_user_policy ON master_excel_output
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE id = current_setting('app.current_user_id')::UUID)
    OR
    EXISTS (SELECT 1 FROM users WHERE id = current_setting('app.current_user_id')::UUID AND role = 'admin')
  );

-- ============================================================================
-- 2. TRIGGER: Actualizar updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_master_excel_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_master_excel_timestamp
  BEFORE UPDATE ON master_excel_output
  FOR EACH ROW
  EXECUTE FUNCTION update_master_excel_timestamp();

-- ============================================================================
-- 3. TRIGGER: Marcar versiones anteriores como obsoletas
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_previous_versions_obsolete()
RETURNS TRIGGER AS $$
BEGIN
  -- Si es una nueva versión de una fila existente
  IF NEW.version > 1 THEN
    -- Marcar versiones anteriores como no-latest
    UPDATE master_excel_output
    SET
      is_latest = false,
      superseded_by = NEW.id
    WHERE extraction_id = NEW.extraction_id
      AND id != NEW.id
      AND version < NEW.version;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mark_previous_versions_obsolete
  AFTER INSERT OR UPDATE OF version ON master_excel_output
  FOR EACH ROW
  EXECUTE FUNCTION mark_previous_versions_obsolete();

-- ============================================================================
-- 4. FUNCIÓN: Obtener todas las filas del Excel master (solo últimas versiones)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_master_excel_rows(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  extraction_id UUID,
  row_data JSONB,
  row_number INTEGER,
  filename VARCHAR,
  validation_status VARCHAR,
  cross_validation_match BOOLEAN,
  discrepancy_count INTEGER,
  version INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.extraction_id,
    m.row_data,
    m.row_number,
    m.filename,
    m.validation_status,
    m.cross_validation_match,
    m.discrepancy_count,
    m.version,
    m.created_at,
    m.updated_at
  FROM master_excel_output m
  WHERE m.user_id = p_user_id
    AND m.is_latest = true
  ORDER BY m.row_number ASC, m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCIÓN: Agregar fila al Excel master
-- ============================================================================

CREATE OR REPLACE FUNCTION add_master_excel_row(
  p_user_id UUID,
  p_extraction_id UUID,
  p_row_data JSONB,
  p_filename VARCHAR,
  p_validation_status VARCHAR DEFAULT 'pending',
  p_cross_validation_match BOOLEAN DEFAULT false,
  p_discrepancy_count INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_row_number INTEGER;
  v_new_id UUID;
BEGIN
  -- Obtener próximo número de fila
  SELECT COALESCE(MAX(row_number), 0) + 1
  INTO v_row_number
  FROM master_excel_output
  WHERE user_id = p_user_id AND is_latest = true;

  -- Insertar nueva fila
  INSERT INTO master_excel_output (
    user_id,
    extraction_id,
    row_data,
    row_number,
    filename,
    validation_status,
    cross_validation_match,
    discrepancy_count,
    version,
    is_latest
  ) VALUES (
    p_user_id,
    p_extraction_id,
    p_row_data,
    v_row_number,
    p_filename,
    p_validation_status,
    p_cross_validation_match,
    p_discrepancy_count,
    1,
    true
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCIÓN: Actualizar fila del Excel master (crea nueva versión)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_master_excel_row(
  p_id UUID,
  p_row_data JSONB,
  p_validation_status VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_current_row RECORD;
  v_new_id UUID;
BEGIN
  -- Obtener fila actual
  SELECT * INTO v_current_row
  FROM master_excel_output
  WHERE id = p_id AND is_latest = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fila no encontrada o ya está obsoleta';
  END IF;

  -- Crear nueva versión
  INSERT INTO master_excel_output (
    user_id,
    extraction_id,
    row_data,
    row_number,
    filename,
    validation_status,
    cross_validation_match,
    discrepancy_count,
    version,
    is_latest
  ) VALUES (
    v_current_row.user_id,
    v_current_row.extraction_id,
    p_row_data,
    v_current_row.row_number,
    v_current_row.filename,
    COALESCE(p_validation_status, v_current_row.validation_status),
    v_current_row.cross_validation_match,
    v_current_row.discrepancy_count,
    v_current_row.version + 1,
    true
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCIÓN: Obtener estadísticas del Excel master
-- ============================================================================

CREATE OR REPLACE FUNCTION get_master_excel_stats(p_user_id UUID)
RETURNS TABLE (
  total_rows INTEGER,
  pending INTEGER,
  valid INTEGER,
  needs_review INTEGER,
  approved INTEGER,
  rejected INTEGER,
  with_discrepancies INTEGER,
  fully_validated INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_rows,
    COUNT(*) FILTER (WHERE validation_status = 'pending')::INTEGER AS pending,
    COUNT(*) FILTER (WHERE validation_status = 'valid')::INTEGER AS valid,
    COUNT(*) FILTER (WHERE validation_status = 'needs_review')::INTEGER AS needs_review,
    COUNT(*) FILTER (WHERE validation_status = 'approved')::INTEGER AS approved,
    COUNT(*) FILTER (WHERE validation_status = 'rejected')::INTEGER AS rejected,
    COUNT(*) FILTER (WHERE discrepancy_count > 0)::INTEGER AS with_discrepancies,
    COUNT(*) FILTER (WHERE cross_validation_match = true)::INTEGER AS fully_validated
  FROM master_excel_output
  WHERE user_id = p_user_id AND is_latest = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VISTA: Vista consolidada del Excel master con información adicional
-- ============================================================================

CREATE OR REPLACE VIEW v_master_excel_output_detailed AS
SELECT
  m.id,
  m.user_id,
  u.email AS user_email,
  m.extraction_id,
  e.filename AS source_pdf,
  m.row_data,
  m.row_number,
  m.filename,
  m.validation_status,
  m.cross_validation_match,
  m.discrepancy_count,
  m.version,
  m.is_latest,
  m.created_at,
  m.updated_at,
  m.processed_at,
  -- Datos clave extraídos del JSON
  m.row_data->>'numero_expediente' AS expediente,
  m.row_data->>'nif_empresa' AS cif,
  m.row_data->>'razon_social' AS empresa,
  m.row_data->>'edad' AS edad,
  m.row_data->>'sexo' AS sexo
FROM master_excel_output m
LEFT JOIN users u ON m.user_id = u.id
LEFT JOIN extraction_results e ON m.extraction_id = e.id
WHERE m.is_latest = true;

-- ============================================================================
-- FIN DE MIGRACIÓN 008
-- ============================================================================

-- Verificar creación
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 008 completada exitosamente';
  RAISE NOTICE '   - Tabla: master_excel_output';
  RAISE NOTICE '   - Índices: 7 creados';
  RAISE NOTICE '   - Triggers: 2 creados';
  RAISE NOTICE '   - Funciones: 5 creadas';
  RAISE NOTICE '   - Vista: v_master_excel_output_detailed';
  RAISE NOTICE '   - RLS: Habilitado';
END $$;
