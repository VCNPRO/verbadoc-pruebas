/**
 * ELIMINAR registros de extraction_results que NO existen en reference_data
 * (Fueron procesados ANTES de arreglar la validación)
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function deleteInvalidExtractions() {
  console.log('==========================================');
  console.log('🧹 LIMPIEZA DE REGISTROS INVÁLIDOS');
  console.log('==========================================\n');

  try {
    // 1. Encontrar TODOS los extraction_results
    const extractions = await sql`
      SELECT
        id,
        filename,
        extracted_data->>'numero_expediente' as expediente,
        extracted_data->>'numero_accion' as accion,
        extracted_data->>'num_accion' as num_accion,
        extracted_data->>'numero_grupo' as grupo,
        extracted_data->>'num_grupo' as num_grupo
      FROM extraction_results
      ORDER BY created_at DESC
    `;

    console.log(`📊 Total registros en extraction_results: ${extractions.rows.length}\n`);

    if (extractions.rows.length === 0) {
      console.log('✅ No hay registros para verificar\n');
      process.exit(0);
    }

    const toDelete = [];

    // 2. Verificar cada uno contra reference_data
    for (const ext of extractions.rows) {
      const numero_expediente = ext.expediente;
      const numero_accion = ext.accion || ext.num_accion;
      const numero_grupo = ext.grupo || ext.num_grupo;

      console.log(`Verificando: ${ext.filename}`);
      console.log(`  Exp: ${numero_expediente}, Acc: ${numero_accion}, Grp: ${numero_grupo}`);

      if (!numero_expediente) {
        console.log(`  ❌ Sin expediente - MARCAR PARA BORRAR\n`);
        toDelete.push({ id: ext.id, filename: ext.filename, reason: 'Sin expediente' });
        continue;
      }

      // Buscar en reference_data
      const exists = await sql`
        SELECT * FROM reference_data
        WHERE is_active = true
        AND data->>'numero_expediente' = ${numero_expediente}
        AND (
          data->>'d_cod_accion_formativa' = ${numero_accion}
          OR data->>'d_cod_accion_formativa' = ${'a - ' + numero_accion}
          OR data->>'id_accion_formativa' = ${numero_accion}
        )
        AND (
          data->>'num_grupo' = ${numero_grupo}
          OR data->>'codigo_grupo_detalle' LIKE ${'%' + numero_grupo + '%'}
        )
        LIMIT 1
      `;

      if (exists.rows.length === 0) {
        console.log(`  ❌ NO existe en Excel - MARCAR PARA BORRAR\n`);
        toDelete.push({
          id: ext.id,
          filename: ext.filename,
          reason: `No existe: Exp=${numero_expediente}, Acc=${numero_accion}, Grp=${numero_grupo}`
        });
      } else {
        console.log(`  ✅ Válido\n`);
      }
    }

    // 3. Mostrar resumen
    console.log('==========================================');
    console.log('📋 RESUMEN');
    console.log('==========================================\n');

    console.log(`Total registros verificados: ${extractions.rows.length}`);
    console.log(`Registros inválidos encontrados: ${toDelete.length}\n`);

    if (toDelete.length === 0) {
      console.log('✅ Todos los registros son válidos. No hay nada que eliminar.\n');
      process.exit(0);
    }

    console.log('🗑️  REGISTROS A ELIMINAR:\n');
    toDelete.forEach((item, i) => {
      console.log(`${i + 1}. ${item.filename}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Razón: ${item.reason}`);
      console.log('');
    });

    console.log('==========================================');
    console.log('⚠️  CONFIRMACIÓN REQUERIDA');
    console.log('==========================================\n');

    console.log('Para ELIMINAR estos registros, ejecuta:\n');
    console.log('node delete-invalid-extractions.js --confirm\n');

    // 4. Si tiene flag --confirm, eliminar
    if (process.argv.includes('--confirm')) {
      console.log('🗑️  ELIMINANDO...\n');

      for (const item of toDelete) {
        try {
          await sql`DELETE FROM extraction_results WHERE id = ${item.id}`;
          console.log(`✅ Eliminado: ${item.filename}`);
        } catch (error) {
          console.error(`❌ Error al eliminar ${item.filename}:`, error.message);
        }
      }

      console.log(`\n✅ ${toDelete.length} registros eliminados\n`);
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

deleteInvalidExtractions();
