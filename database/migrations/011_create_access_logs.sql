/**
 * Migración 011: Crear tabla de logs de acceso
 *
 * Registra TODOS los accesos al sistema para cumplir con requisitos
 * legales y de auditoría.
 *
 * Información registrada:
 * - Quién (user_id + email)
 * - Cuándo (timestamp)
 * - Desde dónde (IP, user agent, ubicación)
 * - Qué acción (login, download, approve, etc.)
 * - Qué recurso (formulario ID, archivo, etc.)
 */

-- 1. Crear tabla de logs
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Usuario
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,

  -- Acción realizada
  action VARCHAR(100) NOT NULL,
  -- Posibles valores:
  -- 'login', 'logout', 'view_review', 'view_unprocessable', 'view_master_excel',
  -- 'download_excel', 'approve_form', 'reject_form', 'fix_error', 'delete_form',
  -- 'upload_reference', 'update_column_mapping', 'view_admin', 'create_user'

  -- Recurso accedido (opcional)
  resource_type VARCHAR(50), -- 'extraction', 'excel_master', 'unprocessable', 'user', etc.
  resource_id VARCHAR(255), -- ID del recurso (UUID de formulario, etc.)
  resource_name VARCHAR(500), -- Nombre del archivo o descripción

  -- Información de la solicitud
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  request_method VARCHAR(10), -- GET, POST, DELETE, etc.
  request_path TEXT,

  -- Ubicación geográfica (si disponible)
  location JSONB, -- {country: 'ES', city: 'Barcelona', region: 'Cataluña'}

  -- Resultado de la acción
  status_code INTEGER, -- 200, 401, 500, etc.
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Metadata adicional
  metadata JSONB, -- Cualquier dato adicional específico de la acción

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  -- Retención (para políticas de borrado)
  retention_until TIMESTAMP DEFAULT (NOW() + INTERVAL '2 years')
);

-- 2. Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_email ON access_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);
CREATE INDEX IF NOT EXISTS idx_access_logs_resource ON access_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_access_logs_retention ON access_logs(retention_until) WHERE retention_until < NOW();

-- 3. Función para registrar acceso (simplificada)
CREATE OR REPLACE FUNCTION log_access(
  p_user_id UUID,
  p_action VARCHAR,
  p_resource_type VARCHAR DEFAULT NULL,
  p_resource_id VARCHAR DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_email VARCHAR;
  v_user_role VARCHAR;
BEGIN
  -- Obtener email y rol del usuario
  SELECT email, role INTO v_user_email, v_user_role
  FROM users
  WHERE id = p_user_id;

  -- Insertar log
  INSERT INTO access_logs (
    user_id,
    user_email,
    user_role,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    success,
    metadata
  ) VALUES (
    p_user_id,
    v_user_email,
    v_user_role,
    p_action,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    p_success,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para auto-log de cambios críticos en users
CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Usuario creado
    PERFORM log_access(
      NEW.id,
      'user_created',
      'user',
      NEW.id::text,
      NULL,
      NULL,
      true,
      jsonb_build_object('email', NEW.email, 'role', NEW.role)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió el rol
    IF OLD.role != NEW.role THEN
      PERFORM log_access(
        NEW.id,
        'role_changed',
        'user',
        NEW.id::text,
        NULL,
        NULL,
        true,
        jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role)
      );
    END IF;

    -- Si se desactivó el usuario
    IF OLD.is_active = true AND NEW.is_active = false THEN
      PERFORM log_access(
        NEW.id,
        'user_deactivated',
        'user',
        NEW.id::text,
        NULL,
        NULL,
        true,
        NULL
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Usuario eliminado
    PERFORM log_access(
      OLD.id,
      'user_deleted',
      'user',
      OLD.id::text,
      NULL,
      NULL,
      true,
      jsonb_build_object('email', OLD.email, 'role', OLD.role)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_log_user_changes ON users;
CREATE TRIGGER trg_log_user_changes
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_user_changes();

-- 5. Vista para reportes de acceso
CREATE OR REPLACE VIEW access_logs_summary AS
SELECT
  DATE(created_at) as date,
  user_email,
  user_role,
  action,
  COUNT(*) as count,
  COUNT(DISTINCT resource_id) as unique_resources,
  COUNT(DISTINCT ip_address) as unique_ips
FROM access_logs
GROUP BY DATE(created_at), user_email, user_role, action
ORDER BY date DESC, count DESC;

-- 6. Función para limpiar logs antiguos (política de retención)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM access_logs
  WHERE retention_until < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Row Level Security (RLS)
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin puede ver todos los logs
CREATE POLICY access_logs_admin_all ON access_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = access_logs.user_id
      AND users.role = 'admin'
    )
  );

-- Policy: Usuarios solo ven sus propios logs
CREATE POLICY access_logs_own_view ON access_logs
  FOR SELECT
  TO authenticated
  USING (user_id = current_setting('app.user_id')::uuid);

-- 8. Comentarios
COMMENT ON TABLE access_logs IS 'Registro completo de todos los accesos al sistema para auditoría';
COMMENT ON FUNCTION log_access IS 'Función helper para registrar un acceso de forma simple';
COMMENT ON FUNCTION cleanup_old_logs IS 'Elimina logs que han cumplido su período de retención (2 años)';
COMMENT ON VIEW access_logs_summary IS 'Vista resumen de accesos por día, usuario y acción';

-- 9. Grants
GRANT SELECT ON access_logs TO authenticated;
GRANT INSERT ON access_logs TO authenticated;
GRANT SELECT ON access_logs_summary TO authenticated;

-- Verificar resultado
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM access_logs;
  RAISE NOTICE 'Migración 011 completada: Tabla access_logs creada (% registros existentes)', v_count;
END $$;
