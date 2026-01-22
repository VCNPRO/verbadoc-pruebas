-- ============================================================================
-- 011: Deshabilitar RLS en extraction_results
-- ============================================================================
-- Problema: RLS está bloqueando DELETE desde la API
-- Causa: Políticas RLS impiden que usuarios borren sus propios registros
-- Solución: Desactivar RLS - los permisos se manejan en código (verifyAuth)
-- ============================================================================

-- Ver políticas actuales
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'extraction_results';

-- Eliminar todas las políticas RLS
DROP POLICY IF EXISTS extraction_results_user_policy ON extraction_results;
DROP POLICY IF EXISTS extraction_results_select_policy ON extraction_results;
DROP POLICY IF EXISTS extraction_results_insert_policy ON extraction_results;
DROP POLICY IF EXISTS extraction_results_update_policy ON extraction_results;
DROP POLICY IF EXISTS extraction_results_delete_policy ON extraction_results;

-- Deshabilitar RLS
ALTER TABLE extraction_results DISABLE ROW LEVEL SECURITY;

-- Comentario
COMMENT ON TABLE extraction_results IS 'Resultados de extracciones - RLS deshabilitado, permisos en código';

-- ============================================================================
-- FIN DE MIGRACIÓN 011
-- ============================================================================
