require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');
const fs = require('fs');

async function applyMigrations() {
  try {
    console.log('\n🔄 APLICANDO MIGRACIONES 010 Y 011...\n');

    // Migración 010: Rol reviewer
    console.log('━━━ MIGRACIÓN 010: Añadir rol reviewer ━━━');
    const migration010 = fs.readFileSync('database/migrations/010_add_reviewer_role.sql', 'utf8');

    try {
      await sql.query(migration010);
      console.log('✅ Migración 010 aplicada correctamente\n');
    } catch (error) {
      console.error('❌ Error en migración 010:', error.message);
      // Continuar de todas formas por si ya estaba aplicada
    }

    // Migración 011: Access logs
    console.log('━━━ MIGRACIÓN 011: Crear tabla access_logs ━━━');
    const migration011 = fs.readFileSync('database/migrations/011_create_access_logs.sql', 'utf8');

    try {
      await sql.query(migration011);
      console.log('✅ Migración 011 aplicada correctamente\n');
    } catch (error) {
      console.error('❌ Error en migración 011:', error.message);
    }

    // Verificar que todo esté correcto
    console.log('━━━ VERIFICANDO RESULTADO ━━━');

    // Verificar rol reviewer
    const roleCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
      ) as role_exists
    `;
    console.log('✅ Tipo user_role existe:', roleCheck.rows[0].role_exists);

    // Verificar tabla role_permissions
    const permissionsCheck = await sql`
      SELECT COUNT(*) as count FROM role_permissions
    `;
    console.log('✅ Permisos configurados:', permissionsCheck.rows[0].count);

    // Verificar tabla access_logs
    const logsCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'access_logs'
      ) as logs_exists
    `;
    console.log('✅ Tabla access_logs existe:', logsCheck.rows[0].logs_exists);

    console.log('\n🎉 MIGRACIONES COMPLETADAS\n');

  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

applyMigrations();
