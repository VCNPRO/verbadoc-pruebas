-- ============================================================================
-- 003: Sistema de Validación Cruzada con Excel
-- ============================================================================
-- Este archivo crea las tablas necesarias para:
-- - Almacenar datos de referencia desde Excel del cliente
-- - Realizar validación cruzada con extracciones de IA
-- - Registrar resultados de comparación
-- ============================================================================

-- Tabla: reference_data
-- Almacena datos de referencia cargados desde Excel del cliente
CREATE TABLE IF NOT EXISTS reference_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_identifier VARCHAR(255) NOT NULL, -- Identificador del formulario (ej: "F-2024-1001")
  data JSONB NOT NULL, -- Datos del formulario en formato JSON
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_file VARCHAR(500), -- Nombre del archivo Excel original
  is_active BOOLEAN DEFAULT true, -- Para soft delete
  metadata JSONB DEFAULT '{}', -- Información adicional (hoja, fila, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: cross_validation_results
-- Almacena resultados de validación cruzada
CREATE TABLE IF NOT EXISTS cross_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID REFERENCES extraction_results(id) ON DELETE CASCADE,
  reference_data_id UUID REFERENCES reference_data(id),
  matches BOOLEAN NOT NULL, -- ¿Los datos coinciden?
  match_percentage DECIMAL(5,2), -- Porcentaje de coincidencia (0-100)
  discrepancy_count INTEGER DEFAULT 0,
  discrepancies JSONB DEFAULT '[]', -- Lista de discrepancias detectadas
  critical_discrepancies INTEGER DEFAULT 0, -- Discrepancias críticas
  warning_discrepancies INTEGER DEFAULT 0, -- Discrepancias de advertencia
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated_by UUID REFERENCES users(id),
  notes TEXT, -- Notas adicionales
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_reference_data_form_identifier
  ON reference_data(form_identifier);

CREATE INDEX IF NOT EXISTS idx_reference_data_uploaded_by
  ON reference_data(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_reference_data_is_active
  ON reference_data(is_active);

CREATE INDEX IF NOT EXISTS idx_reference_data_uploaded_at
  ON reference_data(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_cross_validation_extraction_id
  ON cross_validation_results(extraction_id);

CREATE INDEX IF NOT EXISTS idx_cross_validation_reference_data_id
  ON cross_validation_results(reference_data_id);

CREATE INDEX IF NOT EXISTS idx_cross_validation_matches
  ON cross_validation_results(matches);

CREATE INDEX IF NOT EXISTS idx_cross_validation_validated_at
  ON cross_validation_results(validated_at DESC);

-- Índice GIN para búsquedas eficientes en JSONB
CREATE INDEX IF NOT EXISTS idx_reference_data_data_gin
  ON reference_data USING GIN (data);

CREATE INDEX IF NOT EXISTS idx_cross_validation_discrepancies_gin
  ON cross_validation_results USING GIN (discrepancies);

-- ============================================================================
-- FUNCIONES HELPER
-- ============================================================================

-- Función: Obtener datos de referencia por identificador de formulario
CREATE OR REPLACE FUNCTION get_reference_data_by_form_id(
  p_form_identifier VARCHAR
)
RETURNS TABLE (
  id UUID,
  data JSONB,
  uploaded_at TIMESTAMP,
  source_file VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rd.id,
    rd.data,
    rd.uploaded_at,
    rd.source_file
  FROM reference_data rd
  WHERE rd.form_identifier = p_form_identifier
    AND rd.is_active = true
  ORDER BY rd.uploaded_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Función: Obtener estadísticas de validación cruzada
CREATE OR REPLACE FUNCTION get_cross_validation_stats(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_validations BIGINT,
  successful_matches BIGINT,
  failed_matches BIGINT,
  avg_match_percentage DECIMAL,
  total_critical_discrepancies BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_validations,
    COUNT(CASE WHEN matches = true THEN 1 END)::BIGINT as successful_matches,
    COUNT(CASE WHEN matches = false THEN 1 END)::BIGINT as failed_matches,
    AVG(match_percentage) as avg_match_percentage,
    SUM(critical_discrepancies)::BIGINT as total_critical_discrepancies
  FROM cross_validation_results cvr
  WHERE p_user_id IS NULL OR cvr.validated_by = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Función: Desactivar datos de referencia antiguos al subir nuevos
CREATE OR REPLACE FUNCTION deactivate_old_reference_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando se inserta un nuevo registro activo, desactivar los anteriores del mismo formulario
  IF NEW.is_active = true THEN
    UPDATE reference_data
    SET is_active = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE form_identifier = NEW.form_identifier
      AND id != NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Desactivar datos antiguos
DROP TRIGGER IF EXISTS trigger_deactivate_old_reference_data ON reference_data;

CREATE TRIGGER trigger_deactivate_old_reference_data
  AFTER INSERT ON reference_data
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_old_reference_data();

-- ============================================================================
-- RLS (Row Level Security) - Opcional
-- ============================================================================

-- Habilitar RLS en las tablas
ALTER TABLE reference_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_validation_results ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propios datos de referencia
CREATE POLICY reference_data_user_policy ON reference_data
  FOR ALL
  USING (uploaded_by = current_setting('app.current_user_id')::UUID)
  WITH CHECK (uploaded_by = current_setting('app.current_user_id')::UUID);

-- Política: Los usuarios pueden ver todas las validaciones de sus extracciones
CREATE POLICY cross_validation_user_policy ON cross_validation_results
  FOR ALL
  USING (
    extraction_id IN (
      SELECT id FROM extraction_results
      WHERE user_id = current_setting('app.current_user_id')::UUID
    )
  );

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE reference_data IS 'Almacena datos de referencia cargados desde Excel del cliente para validación cruzada';
COMMENT ON TABLE cross_validation_results IS 'Resultados de comparación entre extracciones de IA y datos de referencia';

COMMENT ON COLUMN reference_data.form_identifier IS 'Identificador único del formulario (ej: número de solicitud)';
COMMENT ON COLUMN reference_data.data IS 'Datos del formulario en formato JSON flexible';
COMMENT ON COLUMN reference_data.is_active IS 'Indica si estos son los datos de referencia actuales (soft delete)';

COMMENT ON COLUMN cross_validation_results.matches IS 'Indica si la extracción coincide con los datos de referencia';
COMMENT ON COLUMN cross_validation_results.match_percentage IS 'Porcentaje de campos que coinciden (0-100)';
COMMENT ON COLUMN cross_validation_results.discrepancies IS 'Lista de discrepancias con detalles (campo, valor esperado, valor obtenido, severidad)';
COMMENT ON COLUMN cross_validation_results.critical_discrepancies IS 'Número de discrepancias críticas que requieren atención inmediata';

-- ============================================================================
-- FIN DE MIGRACIÓN 003
-- ============================================================================
