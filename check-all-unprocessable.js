/**
 * Ver TODOS los documentos no procesables (incluyendo borrados)
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkAllUnprocessable() {
  console.log('==========================================');
  console.log('TODOS LOS DOCUMENTOS NO PROCESABLES');
  console.log('==========================================\n');

  try {
    // Ver TODOS sin filtro de fecha
    const all = await sql`
      SELECT
        id,
        filename,
        rejection_category,
        numero_expediente,
        numero_accion,
        numero_grupo,
        rejection_reason,
        created_at
      FROM unprocessable_documents
      ORDER BY created_at DESC
    `;

    console.log(`Total: ${all.rows.length} documentos\n`);

    if (all.rows.length === 0) {
      console.log('ℹ️  No hay documentos en unprocessable_documents');
      console.log('');
      console.log('POSIBILIDADES:');
      console.log('1. Los borraste con "Limpiar Historial"');
      console.log('2. Nunca se procesó DOC_001/DOC_002 correctamente');
      console.log('3. Los registros se guardaron en otra tabla');
      console.log('');
    } else {
      all.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.filename}`);
        console.log(`   Categoría: ${row.rejection_category}`);
        console.log(`   Exp: ${row.numero_expediente}, Acc: ${row.numero_accion}, Grp: ${row.numero_grupo}`);
        console.log(`   Razón: ${row.rejection_reason}`);
        console.log(`   Fecha: ${row.created_at}`);
        console.log('');
      });
    }

    // Verificar rango de expedientes del Excel
    console.log('==========================================');
    console.log('ANÁLISIS DEL EXCEL DE REFERENCIA');
    console.log('==========================================\n');

    const range = await sql`
      SELECT
        MIN(data->>'numero_expediente') as min_exp,
        MAX(data->>'numero_expediente') as max_exp,
        COUNT(*) as total
      FROM reference_data
      WHERE is_active = true
    `;

    console.log(`Expedientes en Excel: ${range.rows[0].total}`);
    console.log(`Rango: ${range.rows[0].min_exp} hasta ${range.rows[0].max_exp}`);
    console.log('');

    console.log('⚠️  VERIFICACIÓN:');
    console.log('');
    console.log('Si DOC_001 tiene expediente B211801AA:');
    console.log('  - Empieza con "B21" (año 2021?)');
    console.log(`  - Excel tiene: ${range.rows[0].min_exp} hasta ${range.rows[0].max_exp}`);
    console.log('  - ¡El Excel es de 2024! (todos empiezan con B24)');
    console.log('');
    console.log('Si DOC_002 también es de 2021 o 2023:');
    console.log('  - NO estará en el Excel de 2024');
    console.log('  - Necesitas el Excel correcto para ese año');
    console.log('');

    console.log('==========================================');
    console.log('🚨 PREGUNTA CRÍTICA PARA EL USUARIO');
    console.log('==========================================\n');

    console.log('¿De qué AÑO son los 6000 documentos que tienes?');
    console.log('');
    console.log('Si son de 2021-2023:');
    console.log('  → Necesitas el Excel de referencia de ESE año');
    console.log('  → El Excel actual (SS339586_Final_v2) es de 2024');
    console.log('');
    console.log('Si son de 2024:');
    console.log('  → Deberían validar correctamente');
    console.log('  → Procesa uno para verificar');
    console.log('');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAllUnprocessable();
