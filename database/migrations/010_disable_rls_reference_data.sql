-- ============================================================================
-- 010: Deshabilitar RLS en reference_data
-- ============================================================================
-- Problema: reference_data tiene RLS habilitado que bloquea acceso desde API
-- Solución: Los datos de referencia son compartidos para todos los usuarios,
--           no necesitan RLS
-- ============================================================================

-- Eliminar política existente
DROP POLICY IF EXISTS reference_data_user_policy ON reference_data;

-- Deshabilitar RLS en reference_data
ALTER TABLE reference_data DISABLE ROW LEVEL SECURITY;

-- Comentario explicativo
COMMENT ON TABLE reference_data IS 'Datos de referencia compartidos para validación cruzada (sin RLS - data global)';

-- ============================================================================
-- FIN DE MIGRACIÓN 010
-- ============================================================================
