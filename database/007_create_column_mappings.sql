-- ============================================================================
-- MIGRACIÓN 007: SISTEMA DE MAPEO DE COLUMNAS
-- ============================================================================
-- Fecha: 2026-01-10
-- Descripción: Tabla para gestionar el mapeo de campos FUNDAE a columnas Excel
-- ============================================================================

-- ============================================================================
-- 1. TABLA: column_mappings
-- ============================================================================
-- Almacena configuraciones de mapeo de columnas para exportación

CREATE TABLE IF NOT EXISTS column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Información de la configuración
  mapping_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Mapeo de campos FUNDAE → columnas Excel
  mappings JSONB NOT NULL,
  -- Formato: [
  --   {
  --     "fundaeField": "expediente",
  --     "excelColumn": "A",
  --     "excelColumnName": "Nº Expediente",
  --     "required": true,
  --     "transform": "none",
  --     "section": "seccion_i"
  --   },
  --   ...
  -- ]

  -- Estado
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_column_mappings_user_id ON column_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_column_mappings_active ON column_mappings(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_column_mappings_created_at ON column_mappings(created_at DESC);

-- Índice único parcial: Solo un mapeo activo por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_mapping_per_user
  ON column_mappings(user_id)
  WHERE is_active = true;

-- Índice GIN para búsquedas en JSON
CREATE INDEX idx_column_mappings_mappings ON column_mappings USING GIN (mappings);

-- RLS: Los usuarios solo ven sus propias configuraciones
ALTER TABLE column_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY column_mappings_user_policy ON column_mappings
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE id = current_setting('app.current_user_id')::UUID)
    OR
    EXISTS (SELECT 1 FROM users WHERE id = current_setting('app.current_user_id')::UUID AND role = 'admin')
  );

-- ============================================================================
-- 2. TRIGGER: Actualizar updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_column_mappings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_column_mappings_timestamp
  BEFORE UPDATE ON column_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_column_mappings_timestamp();

-- ============================================================================
-- 3. TRIGGER: Solo una configuración activa por usuario
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_single_active_mapping()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Desactivar todas las otras configuraciones del usuario
    UPDATE column_mappings
    SET is_active = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ensure_single_active_mapping
  BEFORE INSERT OR UPDATE OF is_active ON column_mappings
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_mapping();

-- ============================================================================
-- 4. FUNCIÓN: Obtener mapeo activo de un usuario
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_mapping(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  mapping_name VARCHAR,
  mappings JSONB,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.mapping_name,
    cm.mappings,
    cm.created_at
  FROM column_mappings cm
  WHERE cm.user_id = p_user_id
    AND cm.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCIÓN: Obtener campo Excel para un campo FUNDAE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_excel_column_for_fundae_field(
  p_user_id UUID,
  p_fundae_field VARCHAR
)
RETURNS TABLE (
  excel_column VARCHAR,
  excel_column_name VARCHAR,
  transform VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (mapping->>'excelColumn')::VARCHAR AS excel_column,
    (mapping->>'excelColumnName')::VARCHAR AS excel_column_name,
    (mapping->>'transform')::VARCHAR AS transform
  FROM column_mappings cm,
       jsonb_array_elements(cm.mappings) AS mapping
  WHERE cm.user_id = p_user_id
    AND cm.is_active = true
    AND mapping->>'fundaeField' = p_fundae_field
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCIÓN: Validar estructura de mapeo
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_mapping_structure(p_mappings JSONB)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_mapping JSONB;
  v_required_fields TEXT[] := ARRAY['fundaeField', 'excelColumn', 'excelColumnName', 'required'];
  v_field TEXT;
BEGIN
  -- Verificar que es un array
  IF jsonb_typeof(p_mappings) != 'array' THEN
    RETURN QUERY SELECT false, 'Mappings debe ser un array JSON';
    RETURN;
  END IF;

  -- Verificar cada elemento
  FOR v_mapping IN SELECT * FROM jsonb_array_elements(p_mappings) LOOP
    -- Verificar campos requeridos
    FOREACH v_field IN ARRAY v_required_fields LOOP
      IF NOT (v_mapping ? v_field) THEN
        RETURN QUERY SELECT false, format('Falta campo requerido: %s', v_field);
        RETURN;
      END IF;
    END LOOP;
  END LOOP;

  -- Todo válido
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCIÓN: Estadísticas de mapeos
-- ============================================================================

CREATE OR REPLACE FUNCTION get_mapping_statistics(p_user_id UUID)
RETURNS TABLE (
  total_mappings INTEGER,
  active_mapping_id UUID,
  total_fields_mapped INTEGER,
  required_fields_count INTEGER,
  optional_fields_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT cm.id)::INTEGER AS total_mappings,
    (SELECT id FROM column_mappings WHERE user_id = p_user_id AND is_active = true LIMIT 1) AS active_mapping_id,
    (
      SELECT COUNT(*)::INTEGER
      FROM column_mappings cm2,
           jsonb_array_elements(cm2.mappings) AS mapping
      WHERE cm2.user_id = p_user_id AND cm2.is_active = true
    ) AS total_fields_mapped,
    (
      SELECT COUNT(*)::INTEGER
      FROM column_mappings cm3,
           jsonb_array_elements(cm3.mappings) AS mapping
      WHERE cm3.user_id = p_user_id
        AND cm3.is_active = true
        AND (mapping->>'required')::BOOLEAN = true
    ) AS required_fields_count,
    (
      SELECT COUNT(*)::INTEGER
      FROM column_mappings cm4,
           jsonb_array_elements(cm4.mappings) AS mapping
      WHERE cm4.user_id = p_user_id
        AND cm4.is_active = true
        AND (mapping->>'required')::BOOLEAN = false
    ) AS optional_fields_count
  FROM column_mappings cm
  WHERE cm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VISTA: Mapeos con estadísticas
-- ============================================================================

CREATE OR REPLACE VIEW v_column_mappings_with_stats AS
SELECT
  cm.id,
  cm.user_id,
  u.email AS user_email,
  cm.mapping_name,
  cm.description,
  cm.is_active,
  cm.is_default,
  cm.created_at,
  cm.updated_at,
  jsonb_array_length(cm.mappings) AS total_fields,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(cm.mappings) AS mapping
    WHERE (mapping->>'required')::BOOLEAN = true
  ) AS required_fields,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(cm.mappings) AS mapping
    WHERE (mapping->>'required')::BOOLEAN = false
  ) AS optional_fields
FROM column_mappings cm
JOIN users u ON cm.user_id = u.id;

-- ============================================================================
-- 9. CONFIGURACIÓN POR DEFECTO FUNDAE
-- ============================================================================
-- Insertar mapeo por defecto para referencia (opcional)

COMMENT ON TABLE column_mappings IS 'Configuraciones de mapeo de campos FUNDAE a columnas Excel de exportación';
COMMENT ON COLUMN column_mappings.mappings IS 'Array JSON con el mapeo de cada campo FUNDAE a columna Excel';
COMMENT ON COLUMN column_mappings.is_active IS 'Solo una configuración puede estar activa por usuario';
COMMENT ON COLUMN column_mappings.is_default IS 'Indica si es la configuración por defecto del sistema';

-- ============================================================================
-- FIN DE MIGRACIÓN 007
-- ============================================================================

-- Verificar creación
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 007 completada exitosamente';
  RAISE NOTICE '   - Tabla: column_mappings';
  RAISE NOTICE '   - Índices: 4 creados';
  RAISE NOTICE '   - Triggers: 2 creados';
  RAISE NOTICE '   - Funciones: 5 creadas';
  RAISE NOTICE '   - Vista: v_column_mappings_with_stats';
  RAISE NOTICE '   - RLS: Habilitado';
END $$;
