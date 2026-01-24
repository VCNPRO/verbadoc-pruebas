-- ============================================================================
-- MIGRACIÓN 013: TABLA PARA PLANTILLAS DE FORMULARIOS (IDP)
-- ============================================================================
-- Fecha: 2026-01-24
-- Descripción: Tabla para almacenar las plantillas de extracción de documentos,
--              que consisten en un nombre y un array de regiones (campos y
--              coordenadas). Esto es el núcleo del nuevo sistema IDP.
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_templates (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER, -- Para compartir plantillas entre usuarios del mismo cliente

  -- Información de la plantilla
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Regiones (el corazón de la plantilla)
  -- Array de objetos JSON, cada uno representando un campo a extraer.
  -- Formato de cada objeto en 'regions':
  -- { "id": "uuid", "label": "nombre_campo", "type": "field" | "box",
  --   "x": 10.5, "y": 20.3, "width": 30.1, "height": 5.2 }
  regions JSONB NOT NULL,

  -- Metadata
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  thumbnail_url TEXT, -- Opcional, para una vista previa visual

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_form_templates_user_id ON form_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_client_id ON form_templates(client_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_is_active ON form_templates(is_active);

-- Trigger para actualizar 'updated_at'
CREATE OR REPLACE FUNCTION update_form_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_form_templates_timestamp
  BEFORE UPDATE ON form_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_form_templates_timestamp();

-- Habilitar RLS (Row Level Security)
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- Política de acceso: Los usuarios pueden ver/modificar sus propias plantillas
-- o las plantillas compartidas de su mismo cliente (client_id).
-- Los administradores pueden ver/hacer de todo.
CREATE POLICY form_templates_access_policy ON form_templates
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE id = current_setting('app.current_user_id')::UUID)
    OR
    (client_id IS NOT NULL AND client_id = (SELECT client_id FROM users WHERE id = current_setting('app.current_user_id')::UUID))
    OR
    EXISTS (SELECT 1 FROM users WHERE id = current_setting('app.current_user_id')::UUID AND role = 'admin')
  );

COMMENT ON TABLE form_templates IS 'Almacena las plantillas de extracción (regiones y metadatos) para el sistema IDP.';
COMMENT ON COLUMN form_templates.regions IS 'Array de objetos JSON que definen los campos a extraer en un documento.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migración 013 (form_templates) completada exitosamente.';
END $$;
