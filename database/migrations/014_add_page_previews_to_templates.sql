-- ============================================================================
-- MIGRACIÓN 014: AÑADIR PAGE_PREVIEWS A FORM_TEMPLATES
-- ============================================================================
-- Fecha: 2026-01-25
-- Descripción: Añade una columna para almacenar las previsualizaciones de
--              las páginas del documento maestro, permitiendo visualizar
--              la plantilla sin necesidad del PDF original.
-- ============================================================================

-- Añadir columna page_previews para almacenar imágenes base64 de las páginas
ALTER TABLE form_templates
ADD COLUMN IF NOT EXISTS page_previews JSONB;

-- Comentario descriptivo
COMMENT ON COLUMN form_templates.page_previews IS 'Array de strings base64 con las previsualizaciones de cada página del documento maestro.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migración 014 (page_previews) completada exitosamente.';
END $$;
