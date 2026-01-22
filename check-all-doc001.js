/**
 * Buscar TODOS los registros de DOC_001 en todas las tablas
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkAllDoc001() {
  console.log('==========================================');
  console.log('BUSCANDO TODOS LOS REGISTROS DE DOC_001');
  console.log('==========================================\n');

  try {
    // 1. extraction_results
    console.log('1️⃣  extraction_results:\n');
    const ext = await sql`
      SELECT
        id,
        filename,
        extracted_data->>'numero_expediente' as exp,
        extracted_data->>'numero_accion' as acc,
        extracted_data->>'num_accion' as num_acc,
        extracted_data->>'numero_grupo' as grp,
        extracted_data->>'num_grupo' as num_grp,
        validation_status,
        created_at
      FROM extraction_results
      WHERE filename LIKE '%DOC_001%'
      ORDER BY created_at DESC
    `;

    console.log(`Total: ${ext.rows.length} registros\n`);

    if (ext.rows.length > 0) {
      ext.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ID: ${row.id}`);
        console.log(`     Filename: ${row.filename}`);
        console.log(`     Exp: ${row.exp}, Acc: ${row.acc || row.num_acc}, Grp: ${row.grp || row.num_grp}`);
        console.log(`     Status: ${row.validation_status}`);
        console.log(`     Created: ${row.created_at}\n`);
      });
    }

    // 2. unprocessable_documents
    console.log('2️⃣  unprocessable_documents:\n');
    const unproc = await sql`
      SELECT
        id,
        filename,
        rejection_category,
        numero_expediente,
        numero_accion,
        numero_grupo,
        created_at
      FROM unprocessable_documents
      WHERE filename LIKE '%DOC_001%'
      ORDER BY created_at DESC
    `;

    console.log(`Total: ${unproc.rows.length} registros\n`);

    if (unproc.rows.length > 0) {
      unproc.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ID: ${row.id}`);
        console.log(`     Filename: ${row.filename}`);
        console.log(`     Category: ${row.rejection_category}`);
        console.log(`     Exp: ${row.numero_expediente}, Acc: ${row.numero_accion}, Grp: ${row.numero_grupo}`);
        console.log(`     Created: ${row.created_at}\n`);
      });
    }

    // 3. master_excel_output
    console.log('3️⃣  master_excel_output:\n');
    const master = await sql`
      SELECT
        id,
        filename,
        row_data->>'numero_expediente' as exp,
        validation_status,
        created_at
      FROM master_excel_output
      WHERE filename LIKE '%DOC_001%'
      ORDER BY created_at DESC
    `;

    console.log(`Total: ${master.rows.length} registros\n`);

    if (master.rows.length > 0) {
      master.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ID: ${row.id}`);
        console.log(`     Filename: ${row.filename}`);
        console.log(`     Exp: ${row.exp}`);
        console.log(`     Status: ${row.validation_status}`);
        console.log(`     Created: ${row.created_at}\n`);
      });
    }

    // 4. Buscar con B211801AA
    console.log('4️⃣  Buscando por B211801AA en extraction_results:\n');
    const byExp = await sql`
      SELECT
        id,
        filename,
        extracted_data->>'numero_expediente' as exp,
        validation_status,
        created_at
      FROM extraction_results
      WHERE extracted_data->>'numero_expediente' = 'B211801AA'
      ORDER BY created_at DESC
    `;

    console.log(`Total: ${byExp.rows.length} registros\n`);

    if (byExp.rows.length > 0) {
      byExp.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ID: ${row.id}`);
        console.log(`     Filename: ${row.filename}`);
        console.log(`     Exp: ${row.exp}`);
        console.log(`     Status: ${row.validation_status}`);
        console.log(`     Created: ${row.created_at}\n`);
      });
    }

    console.log('==========================================');
    console.log('RESUMEN FINAL');
    console.log('==========================================\n');

    console.log(`extraction_results: ${ext.rows.length} registros`);
    console.log(`unprocessable_documents: ${unproc.rows.length} registros`);
    console.log(`master_excel_output: ${master.rows.length} registros`);
    console.log(`Con expediente B211801AA: ${byExp.rows.length} registros\n`);

    if (ext.rows.length > 0) {
      console.log('⚠️  PROBLEMA: DOC_001 está en extraction_results cuando NO debería');
      console.log('    Posibles causas:');
      console.log('    1. Se procesó ANTES de arreglar el bug');
      console.log('    2. El código todavía está usando versión vieja (no deployado)');
      console.log('    3. Hay que eliminar registros antiguos\n');

      console.log('💡 SOLUCIÓN: Eliminar estos registros de extraction_results');
      console.log('    SQL:');
      ext.rows.forEach(row => {
        console.log(`    DELETE FROM extraction_results WHERE id = '${row.id}';`);
      });
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAllDoc001();
