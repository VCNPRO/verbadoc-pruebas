/**
 * Ejecutar migración 011: Deshabilitar RLS en extraction_results
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración 011: Deshabilitar RLS en extraction_results\n');

    // 1. Ver políticas actuales
    console.log('1. Políticas RLS actuales:');
    const policies = await sql`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE tablename = 'extraction_results'
    `;

    if (policies.rows.length > 0) {
      policies.rows.forEach(p => console.log(`   - ${p.policyname} (${p.cmd})`));
    } else {
      console.log('   (ninguna)');
    }
    console.log('');

    // 2. Eliminar políticas
    console.log('2. Eliminando políticas RLS...');
    await sql`DROP POLICY IF EXISTS extraction_results_user_policy ON extraction_results`;
    await sql`DROP POLICY IF EXISTS extraction_results_select_policy ON extraction_results`;
    await sql`DROP POLICY IF EXISTS extraction_results_insert_policy ON extraction_results`;
    await sql`DROP POLICY IF EXISTS extraction_results_update_policy ON extraction_results`;
    await sql`DROP POLICY IF EXISTS extraction_results_delete_policy ON extraction_results`;
    console.log('   ✅ Políticas eliminadas\n');

    // 3. Deshabilitar RLS
    console.log('3. Deshabilitando RLS...');
    await sql`ALTER TABLE extraction_results DISABLE ROW LEVEL SECURITY`;
    console.log('   ✅ RLS deshabilitado\n');

    // 4. Actualizar comentario
    console.log('4. Actualizando comentario...');
    await sql`COMMENT ON TABLE extraction_results IS 'Resultados de extracciones - RLS deshabilitado, permisos en código'`;
    console.log('   ✅ Comentario actualizado\n');

    // 5. Verificar
    console.log('5. Verificando estado de RLS...');
    const check = await sql`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE tablename = 'extraction_results'
    `;

    if (check.rows[0].rowsecurity) {
      console.log('   ❌ RLS todavía está habilitado\n');
    } else {
      console.log('   ✅ RLS está deshabilitado\n');
    }

    console.log('==========================================');
    console.log('✅ MIGRACIÓN 011 COMPLETADA');
    console.log('==========================================\n');

    console.log('Ahora puedes:');
    console.log('1. Borrar DOC_002 desde /resultados');
    console.log('2. El borrado debería funcionar correctamente\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

runMigration();
