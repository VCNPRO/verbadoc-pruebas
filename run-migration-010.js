/**
 * Ejecutar migración 010: Deshabilitar RLS en reference_data
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración 010: Deshabilitar RLS en reference_data\n');

    const migrationSQL = readFileSync('./database/migrations/010_disable_rls_reference_data.sql', 'utf8');

    await sql.query(migrationSQL);

    console.log('✅ Migración 010 ejecutada correctamente\n');

    // Verificar que RLS está deshabilitado
    const check = await sql`
      SELECT
        relname,
        relrowsecurity
      FROM pg_class
      WHERE relname = 'reference_data'
    `;

    console.log('Verificación:');
    console.log(`  Tabla: ${check.rows[0].relname}`);
    console.log(`  RLS habilitado: ${check.rows[0].relrowsecurity ? 'SÍ ❌' : 'NO ✅'}\n');

    if (!check.rows[0].relrowsecurity) {
      console.log('🎉 RLS deshabilitado exitosamente en reference_data');
      console.log('   Ahora la API puede acceder a los datos de referencia sin restricciones\n');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

runMigration();
