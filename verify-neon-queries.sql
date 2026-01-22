-- ============================================================================
-- QUERIES PARA VERIFICAR REFERENCE_DATA EN NEON CONSOLE
-- ============================================================================
-- Ejecuta estas queries en: https://console.neon.tech
-- Selecciona tu proyecto verbadocpro > SQL Editor
-- ============================================================================

-- QUERY 1: Verificar si hay datos en reference_data
-- ============================================================================
SELECT
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  MIN(uploaded_at) as primer_upload,
  MAX(uploaded_at) as ultimo_upload,
  COUNT(DISTINCT source_file) as archivos_distintos
FROM reference_data;

-- RESULTADO ESPERADO:
-- Si SS339586_Final_v2 está cargado, deberías ver ~1290 registros


-- ============================================================================
-- QUERY 2: Ver qué archivos Excel están cargados
-- ============================================================================
SELECT
  source_file,
  COUNT(*) as filas,
  uploaded_at,
  is_active
FROM reference_data
GROUP BY source_file, uploaded_at, is_active
ORDER BY uploaded_at DESC;

-- RESULTADO ESPERADO:
-- Deberías ver "SS339586_Final_v2.xlsx" o similar con ~1290 filas


-- ============================================================================
-- QUERY 3: CRÍTICO - Verificar columnas del Excel
-- ============================================================================
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN data ? 'D-EXPEDIENTE' THEN 1 END) as con_d_expediente,
  COUNT(CASE WHEN data ? 'D_COD_ACCION' THEN 1 END) as con_d_cod_accion,
  COUNT(CASE WHEN data ? 'D_COD_GRUPO' THEN 1 END) as con_d_cod_grupo,
  COUNT(CASE WHEN data ? 'numero_expediente' THEN 1 END) as con_numero_expediente,
  COUNT(CASE WHEN data ? 'expediente' THEN 1 END) as con_expediente
FROM reference_data
WHERE is_active = true;

-- RESULTADO ESPERADO:
-- Si las columnas son correctas:
-- - con_d_expediente: ~1290
-- - con_d_cod_accion: ~1290
-- - con_d_cod_grupo: ~1290


-- ============================================================================
-- QUERY 4: Ver un registro de ejemplo
-- ============================================================================
SELECT
  id,
  form_identifier,
  data,
  source_file,
  uploaded_at
FROM reference_data
WHERE is_active = true
LIMIT 1;

-- RESULTADO ESPERADO:
-- Deberías ver el JSON con las claves: D-EXPEDIENTE, D_COD_ACCION, D_COD_GRUPO


-- ============================================================================
-- QUERY 5: Ver las claves JSONB que existen (las primeras 10)
-- ============================================================================
SELECT DISTINCT jsonb_object_keys(data) as columna
FROM reference_data
WHERE is_active = true
LIMIT 20;

-- RESULTADO ESPERADO:
-- Lista de todas las columnas del Excel, incluyendo:
-- - D-EXPEDIENTE
-- - D_COD_ACCION
-- - D_COD_GRUPO


-- ============================================================================
-- QUERY 6: Buscar un registro específico (ejemplo con los datos de DOC_001)
-- ============================================================================
-- Reemplaza estos valores con los del documento que procesaste:
SELECT
  id,
  form_identifier,
  data->>'D-EXPEDIENTE' as expediente,
  data->>'D_COD_ACCION' as accion,
  data->>'D_COD_GRUPO' as grupo,
  source_file
FROM reference_data
WHERE is_active = true
  AND (
    data->>'D-EXPEDIENTE' = 'F22006003'  -- 🔥 REEMPLAZA con el valor real
    OR data->>'D-EXPEDIENTE' LIKE '%22006003%'
  )
LIMIT 5;

-- Si no encuentra nada, ese documento NO está en el Excel de referencia


-- ============================================================================
-- QUERY 7: Ver distribución de valores (primeros 10 expedientes)
-- ============================================================================
SELECT
  data->>'D-EXPEDIENTE' as expediente,
  data->>'D_COD_ACCION' as accion,
  data->>'D_COD_GRUPO' as grupo,
  source_file
FROM reference_data
WHERE is_active = true
LIMIT 10;

-- RESULTADO ESPERADO:
-- Lista de los primeros 10 registros del Excel para ver el formato real


-- ============================================================================
-- QUERY 8: VERIFICAR RLS (Row Level Security)
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'reference_data';

-- RESULTADO ESPERADO:
-- Deberías ver la política "reference_data_user_policy"
-- Si esta política está bloqueando el acceso, necesitamos deshabilitarla
