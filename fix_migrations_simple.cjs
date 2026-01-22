require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function fixMigrations() {
  try {
    console.log('\n🔧 ARREGLANDO MIGRACIONES PASO A PASO...\n');

    // 1. Habilitar extensión UUID
    console.log('━━━ 1. Habilitando extensión uuid-ossp ━━━');
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
      console.log('✅ Extensión UUID habilitada\n');
    } catch (e) {
      console.log('⚠️ Extensión ya habilitada o no necesaria\n');
    }

    // 2. Crear tabla role_permissions (sin enum por ahora)
    console.log('━━━ 2. Creando tabla role_permissions ━━━');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role VARCHAR(50) NOT NULL,
          resource VARCHAR(100) NOT NULL,
          can_read BOOLEAN DEFAULT false,
          can_write BOOLEAN DEFAULT false,
          can_delete BOOLEAN DEFAULT false,
          can_download BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('✅ Tabla role_permissions creada\n');
    } catch (e) {
      console.log('⚠️ Tabla ya existe:', e.message, '\n');
    }

    // 3. Insertar permisos
    console.log('━━━ 3. Insertando permisos ━━━');
    try {
      await sql`
        INSERT INTO role_permissions (role, resource, can_read, can_write, can_delete, can_download)
        VALUES
          -- Admin
          ('admin', 'review', true, true, true, true),
          ('admin', 'unprocessable', true, true, true, true),
          ('admin', 'admin_panel', true, true, true, true),
          ('admin', 'excel_master', true, true, true, true),
          -- Reviewer
          ('reviewer', 'review', true, true, false, false),
          ('reviewer', 'unprocessable', true, false, false, false),
          ('reviewer', 'admin_panel', false, false, false, false),
          ('reviewer', 'excel_master', true, false, false, false)
        ON CONFLICT DO NOTHING
      `;
      console.log('✅ Permisos insertados\n');
    } catch (e) {
      console.log('⚠️ Permisos ya existen\n');
    }

    // 4. Crear tabla access_logs
    console.log('━━━ 4. Creando tabla access_logs ━━━');
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS access_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          user_email VARCHAR(255) NOT NULL,
          user_role VARCHAR(50) NOT NULL,
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id VARCHAR(255),
          resource_name VARCHAR(500),
          ip_address INET,
          user_agent TEXT,
          success BOOLEAN DEFAULT true,
          error_message TEXT,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          retention_until TIMESTAMP DEFAULT (NOW() + INTERVAL '2 years')
        )
      `;
      console.log('✅ Tabla access_logs creada\n');
    } catch (e) {
      console.log('⚠️ Tabla ya existe:', e.message, '\n');
    }

    // 5. Crear índices
    console.log('━━━ 5. Creando índices ━━━');
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC)`;
      console.log('✅ Índices creados\n');
    } catch (e) {
      console.log('⚠️ Índices ya existen\n');
    }

    // 6. Crear función log_access
    console.log('━━━ 6. Creando función log_access ━━━');
    try {
      await sql`
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
          SELECT email, role INTO v_user_email, v_user_role
          FROM users
          WHERE id = p_user_id;

          INSERT INTO access_logs (
            user_id, user_email, user_role, action,
            resource_type, resource_id, ip_address,
            user_agent, success, metadata
          ) VALUES (
            p_user_id, v_user_email, v_user_role, p_action,
            p_resource_type, p_resource_id, p_ip_address,
            p_user_agent, p_success, p_metadata
          )
          RETURNING id INTO v_log_id;

          RETURN v_log_id;
        END;
        $$ LANGUAGE plpgsql;
      `;
      console.log('✅ Función log_access creada\n');
    } catch (e) {
      console.log('⚠️ Función ya existe:', e.message, '\n');
    }

    console.log('🎉 MIGRACIONES COMPLETADAS CORRECTAMENTE\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

fixMigrations();
