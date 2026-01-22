/**
 * Ejecutar migración 010: Deshabilitar RLS en reference_data
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración 010: Deshabilitar RLS en reference_data\n');

    // 1. Eliminar política existente
    console.log('1. Eliminando política RLS existente...');
    await sql`DROP POLICY IF EXISTS reference_data_user_policy ON reference_data`;
    console.log('   ✅ Política eliminada\n');

    // 2. Deshabilitar RLS
    console.log('2. Deshabilitando RLS en reference_data...');
    await sql`ALTER TABLE reference_data DISABLE ROW LEVEL SECURITY`;
    console.log('   ✅ RLS deshabilitado\n');

    // 3. Actualizar comentario
    console.log('3. Actualizando comentario de tabla...');
    await sql`COMMENT ON TABLE reference_data IS 'Datos de referencia compartidos para validación cruzada (sin RLS - data global)'`;
    console.log('   ✅ Comentario actualizado\n');

    console.log('✅ Migración 010 ejecutada correctamente\n');

    // Verificar que RLS está deshabilitado
    console.log('4. Verificando estado de RLS...');
    const check = await sql`
      SELECT
        relname,
        relrowsecurity
      FROM pg_class
      WHERE relname = 'reference_data'
    `;

    console.log('   Resultado:');
    console.log(`   - Tabla: ${check.rows[0].relname}`);
    console.log(`   - RLS habilitado: ${check.rows[0].relrowsecurity ? 'SÍ ❌' : 'NO ✅'}\n`);

    if (!check.rows[0].relrowsecurity) {
      console.log('🎉 RLS deshabilitado exitosamente en reference_data');
      console.log('   Ahora la API puede acceder a los datos de referencia sin restricciones\n');
    } else {
      console.log('⚠️  RLS todavía está habilitado\n');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

runMigration();
