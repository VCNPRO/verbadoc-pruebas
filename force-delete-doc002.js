/**
 * Eliminar DOC_002 directamente de extraction_results
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function forceDelete() {
  try {
    // 1. Buscar DOC_002
    console.log('🔍 Buscando DOC_002 en extraction_results...\n');

    const doc002 = await sql`
      SELECT id, user_id, filename
      FROM extraction_results
      WHERE filename LIKE '%DOC_002%'
      LIMIT 1
    `;

    if (doc002.rows.length === 0) {
      console.log('✅ DOC_002 no encontrado en extraction_results (ya fue eliminado o nunca existió)\n');
      process.exit(0);
    }

    const doc = doc002.rows[0];
    console.log(`📄 Encontrado:`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   User ID: ${doc.user_id}`);
    console.log(`   Filename: ${doc.filename}\n`);

    // 2. Verificar foreign keys
    console.log('🔗 Verificando dependencias (foreign keys)...\n');

    const validation_errors = await sql`
      SELECT COUNT(*) as count
      FROM validation_errors
      WHERE extraction_id = ${doc.id}
    `;
    console.log(`   validation_errors: ${validation_errors.rows[0].count}`);

    const master_excel = await sql`
      SELECT COUNT(*) as count
      FROM master_excel_output
      WHERE extraction_id = ${doc.id}
    `;
    console.log(`   master_excel_output: ${master_excel.rows[0].count}\n`);

    // 3. Eliminar dependencias primero
    if (parseInt(validation_errors.rows[0].count) > 0) {
      console.log('🗑️  Eliminando validation_errors...');
      await sql`DELETE FROM validation_errors WHERE extraction_id = ${doc.id}`;
      console.log('   ✅ Eliminados\n');
    }

    if (parseInt(master_excel.rows[0].count) > 0) {
      console.log('🗑️  Eliminando master_excel_output...');
      await sql`DELETE FROM master_excel_output WHERE extraction_id = ${doc.id}`;
      console.log('   ✅ Eliminados\n');
    }

    // 4. Eliminar el registro principal
    console.log('🗑️  Eliminando extraction_results...');
    const result = await sql`
      DELETE FROM extraction_results
      WHERE id = ${doc.id}
    `;

    if ((result.rowCount ?? 0) > 0) {
      console.log('   ✅ ELIMINADO EXITOSAMENTE\n');
      console.log('==========================================');
      console.log('✅ DOC_002 ELIMINADO COMPLETAMENTE');
      console.log('==========================================\n');
      console.log('Ahora:');
      console.log('1. Ve a /resultados');
      console.log('2. Haz CTRL + F5 (hard refresh)');
      console.log('3. DOC_002 ya no debería aparecer\n');
    } else {
      console.log('   ❌ No se pudo eliminar\n');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

forceDelete();
