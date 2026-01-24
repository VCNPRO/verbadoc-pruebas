-- ============================================================================
-- MIGRACIÓN 013: Añadir columna client_id a la tabla users
-- ============================================================================
-- Fecha: 2026-01-24
-- Descripción: Permite compartir datos entre usuarios del mismo cliente
-- ============================================================================

-- 1. Añadir columna client_id a users (nullable para usuarios existentes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id INTEGER;

-- 2. Crear índice para búsquedas rápidas por client_id
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);

-- 3. Comentario
COMMENT ON COLUMN users.client_id IS 'ID del cliente para compartir datos entre usuarios de la misma organización';

-- Verificar resultado
DO $$
BEGIN
  RAISE NOTICE 'Migración 013 completada: Columna client_id añadida a users';
END $$;
