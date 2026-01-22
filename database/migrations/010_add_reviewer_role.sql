/**
 * Migración 010: Añadir rol 'reviewer' para usuarios Normadat
 *
 * Los usuarios reviewer tienen acceso limitado:
 * - Pueden ver /review (formularios con errores)
 * - Pueden ver /unprocessable (documentos no procesables)
 * - Pueden aprobar/rechazar formularios
 * - Pueden corregir errores
 * - NO pueden acceder a /admin
 * - NO pueden cargar Excel de referencia
 * - NO pueden descargar Excel Master (solo visualizar)
 */

-- 1. Modificar el tipo de enum para incluir 'reviewer'
-- Nota: En PostgreSQL no se puede modificar un ENUM directamente
-- Hay que crear uno nuevo y migrar

-- Verificar si ya existe el tipo nuevo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
    -- Crear nuevo tipo con 'reviewer'
    CREATE TYPE user_role_new AS ENUM ('admin', 'user', 'reviewer');

    -- Migrar datos
    ALTER TABLE users ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;

    -- Eliminar tipo antiguo
    DROP TYPE IF EXISTS user_role CASCADE;

    -- Renombrar nuevo tipo
    ALTER TYPE user_role_new RENAME TO user_role;

    RAISE NOTICE 'Rol reviewer añadido exitosamente';
  ELSE
    RAISE NOTICE 'El rol reviewer ya existe';
  END IF;
END $$;

-- 2. Crear tabla de permisos por rol (opcional pero recomendado)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL, -- 'review', 'unprocessable', 'admin', 'excel_master', etc.
  can_read BOOLEAN DEFAULT false,
  can_write BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_download BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Insertar permisos para cada rol

-- Permisos ADMIN (acceso total)
INSERT INTO role_permissions (role, resource, can_read, can_write, can_delete, can_download)
VALUES
  ('admin', 'review', true, true, true, true),
  ('admin', 'unprocessable', true, true, true, true),
  ('admin', 'admin_panel', true, true, true, true),
  ('admin', 'excel_master', true, true, true, true),
  ('admin', 'reference_data', true, true, true, true),
  ('admin', 'column_mapping', true, true, true, true),
  ('admin', 'access_logs', true, false, false, true)
ON CONFLICT DO NOTHING;

-- Permisos REVIEWER (acceso limitado)
INSERT INTO role_permissions (role, resource, can_read, can_write, can_delete, can_download)
VALUES
  ('review', 'review', true, true, false, false), -- Puede ver y editar, no borrar
  ('reviewer', 'unprocessable', true, false, false, false), -- Solo lectura
  ('reviewer', 'admin_panel', false, false, false, false), -- Sin acceso
  ('reviewer', 'excel_master', true, false, false, false), -- Solo visualizar, no descargar
  ('reviewer', 'reference_data', false, false, false, false), -- Sin acceso
  ('reviewer', 'column_mapping', false, false, false, false), -- Sin acceso
  ('reviewer', 'access_logs', false, false, false, false) -- Sin acceso
ON CONFLICT DO NOTHING;

-- Permisos USER (acceso básico - si aplica)
INSERT INTO role_permissions (role, resource, can_read, can_write, can_delete, can_download)
VALUES
  ('user', 'review', true, true, false, false),
  ('user', 'unprocessable', true, false, false, false),
  ('user', 'admin_panel', false, false, false, false),
  ('user', 'excel_master', true, false, false, true), -- Puede descargar
  ('user', 'reference_data', false, false, false, false),
  ('user', 'column_mapping', false, false, false, false),
  ('user', 'access_logs', false, false, false, false)
ON CONFLICT DO NOTHING;

-- 4. Crear índice
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_resource ON role_permissions(resource);

-- 5. Función helper para verificar permisos
CREATE OR REPLACE FUNCTION check_permission(
  p_user_role VARCHAR,
  p_resource VARCHAR,
  p_action VARCHAR -- 'read', 'write', 'delete', 'download'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Admin siempre tiene todos los permisos
  IF p_user_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Buscar permiso específico
  SELECT
    CASE p_action
      WHEN 'read' THEN can_read
      WHEN 'write' THEN can_write
      WHEN 'delete' THEN can_delete
      WHEN 'download' THEN can_download
      ELSE false
    END INTO v_has_permission
  FROM role_permissions
  WHERE role = p_user_role AND resource = p_resource;

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql;

-- 6. Comentarios
COMMENT ON TABLE role_permissions IS 'Define permisos granulares por rol y recurso';
COMMENT ON FUNCTION check_permission IS 'Verifica si un rol tiene permiso para una acción en un recurso';

-- Verificar resultado
DO $$
BEGIN
  RAISE NOTICE 'Migración 010 completada: Rol reviewer y sistema de permisos creado';
END $$;
