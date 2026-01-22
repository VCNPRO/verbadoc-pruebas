/**
 * Verificar estado actual del sistema
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';

config({ path: '.env.production', override: true });

async function checkState() {
  console.log('🔍 ESTADO ACTUAL DEL SISTEMA\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Contar formularios por estado
    console.log('1️⃣ FORMULARIOS POR ESTADO:\n');
    const byStatus = await sql`
      SELECT
        validation_status,
        COUNT(*) as total
      FROM extraction_results
      GROUP BY validation_status
      ORDER BY total DESC
    `;

    if (byStatus.rows.length === 0) {
      console.log('   ❌ No hay formularios procesados\n');
    } else {
      byStatus.rows.forEach(row => {
        console.log(`   ${row.validation_status.toUpperCase().padEnd(15)}: ${row.total} formularios`);
      });
      console.log();
    }

    // 2. Ver últimos formularios procesados
    console.log('2️⃣ ÚLTIMOS FORMULARIOS PROCESADOS:\n');
    const recent = await sql`
      SELECT
        id,
        filename,
        validation_status,
        created_at,
        extracted_data->>'numero_expediente' as expediente
      FROM extraction_results
      ORDER BY created_at DESC
      LIMIT 5
    `;

    if (recent.rows.length === 0) {
      console.log('   ❌ No hay formularios\n');
    } else {
      recent.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. ${row.filename}`);
        console.log(`   Estado: ${row.validation_status}`);
        console.log(`   Expediente: ${row.expediente || 'N/A'}`);
        console.log(`   Fecha: ${new Date(row.created_at).toLocaleString()}`);
        console.log();
      });
    }

    // 3. Ver Excel de validación
    console.log('3️⃣ EXCEL DE VALIDACIÓN:\n');
    const refData = await sql`
      SELECT COUNT(*) as total FROM reference_data WHERE is_active = true
    `;
    console.log(`   ✅ ${refData.rows[0].total} expedientes cargados\n`);

    // 4. Resumen
    console.log('═══════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════\n');

    const totalForms = await sql`SELECT COUNT(*) as total FROM extraction_results`;
    const total = parseInt(totalForms.rows[0].total);

    console.log(`✅ Total formularios procesados: ${total}`);
    console.log(`✅ Excel de validación: ${refData.rows[0].total} expedientes`);
    console.log();

    if (total === 0) {
      console.log('⚠️  NO HAY FORMULARIOS PROCESADOS');
      console.log('   Sube un PDF en: https://www.verbadocpro.eu');
      console.log();
    } else {
      console.log('✅ Sistema funcionando');
      console.log('   Ve a: https://www.verbadocpro.eu/review');
      console.log();
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }
}

checkState();
