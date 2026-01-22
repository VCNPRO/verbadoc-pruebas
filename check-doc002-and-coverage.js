/**
 * VERIFICACIÓN CRÍTICA: DOC_002 y cobertura del Excel
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkCoverage() {
  console.log('==========================================');
  console.log('🚨 VERIFICACIÓN CRÍTICA DE COBERTURA');
  console.log('==========================================\n');

  try {
    // 1. Verificar DOC_002 si existe en BD
    console.log('1️⃣  Buscando DOC_002 en unprocessable_documents:\n');
    const doc002 = await sql`
      SELECT
        filename,
        rejection_category,
        rejection_reason,
        numero_expediente,
        numero_accion,
        numero_grupo,
        created_at
      FROM unprocessable_documents
      WHERE filename LIKE '%DOC_002%'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (doc002.rows.length > 0) {
      const doc = doc002.rows[0];
      console.log('✅ DOC_002 encontrado en unprocessable_documents:');
      console.log(`   Expediente: ${doc.numero_expediente}`);
      console.log(`   Acción: ${doc.numero_accion}`);
      console.log(`   Grupo: ${doc.numero_grupo}`);
      console.log(`   Razón: ${doc.rejection_reason}`);
      console.log('');

      // Verificar si este expediente existe en reference_data
      console.log('2️⃣  Verificando si expediente existe en Excel de referencia:\n');
      const exists = await sql`
        SELECT
          data->>'numero_expediente' as expediente,
          data->>'d_cod_accion_formativa' as accion,
          data->>'num_grupo' as grupo
        FROM reference_data
        WHERE is_active = true
        AND data->>'numero_expediente' = ${doc.numero_expediente}
        LIMIT 1
      `;

      if (exists.rows.length > 0) {
        console.log('✅ El expediente SÍ existe en el Excel:');
        console.log(`   Expediente: ${exists.rows[0].expediente}`);
        console.log(`   Acción en Excel: ${exists.rows[0].accion}`);
        console.log(`   Grupo en Excel: ${exists.rows[0].grupo}`);
        console.log('');
        console.log('⚠️  PROBLEMA: El expediente existe pero con DIFERENTE acción/grupo');
        console.log(`   Extraído: Acción=${doc.numero_accion}, Grupo=${doc.numero_grupo}`);
        console.log(`   En Excel: Acción=${exists.rows[0].accion}, Grupo=${exists.rows[0].grupo}`);
        console.log('');
      } else {
        console.log(`❌ El expediente "${doc.numero_expediente}" NO existe en el Excel\n`);
      }
    } else {
      console.log('ℹ️  DOC_002 no encontrado en unprocessable_documents\n');
      console.log('   (Posiblemente no se ha procesado aún)\n');
    }

    // 3. Estadísticas del Excel de referencia
    console.log('3️⃣  ESTADÍSTICAS DEL EXCEL DE REFERENCIA:\n');

    const stats = await sql`
      SELECT
        COUNT(*) as total_registros,
        COUNT(DISTINCT data->>'numero_expediente') as expedientes_unicos,
        MIN((data->>'numero_expediente')::text) as primer_expediente,
        MAX((data->>'numero_expediente')::text) as ultimo_expediente
      FROM reference_data
      WHERE is_active = true
    `;

    console.log(`Total registros: ${stats.rows[0].total_registros}`);
    console.log(`Expedientes únicos: ${stats.rows[0].expedientes_unicos}`);
    console.log(`Primer expediente: ${stats.rows[0].primer_expediente}`);
    console.log(`Último expediente: ${stats.rows[0].ultimo_expediente}`);
    console.log('');

    // 4. Ver algunos expedientes de ejemplo
    console.log('4️⃣  MUESTRA DE 10 EXPEDIENTES DEL EXCEL:\n');

    const sample = await sql`
      SELECT DISTINCT
        data->>'numero_expediente' as expediente,
        data->>'d_cod_accion_formativa' as accion,
        data->>'num_grupo' as grupo
      FROM reference_data
      WHERE is_active = true
      LIMIT 10
    `;

    sample.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. Exp: ${row.expediente}, Acc: ${row.accion}, Grp: ${row.grupo}`);
    });
    console.log('');

    // 5. Verificar documentos no procesables
    console.log('5️⃣  DOCUMENTOS NO PROCESABLES (sin_referencia):\n');

    const unproc = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN rejection_category = 'sin_referencia' THEN 1 END) as sin_referencia,
        COUNT(CASE WHEN rejection_category = 'campos_faltantes' THEN 1 END) as campos_faltantes
      FROM unprocessable_documents
    `;

    console.log(`Total no procesables: ${unproc.rows[0].total}`);
    console.log(`Sin referencia: ${unproc.rows[0].sin_referencia}`);
    console.log(`Campos faltantes: ${unproc.rows[0].campos_faltantes}`);
    console.log('');

    // 6. ANÁLISIS CRÍTICO
    console.log('==========================================');
    console.log('🚨 ANÁLISIS CRÍTICO');
    console.log('==========================================\n');

    const totalExcel = parseInt(stats.rows[0].total_registros);
    const totalRechazados = parseInt(unproc.rows[0].sin_referencia);

    console.log('SITUACIÓN ACTUAL:');
    console.log(`- Excel de referencia: ${totalExcel} registros`);
    console.log(`- Documentos rechazados (sin_referencia): ${totalRechazados}`);
    console.log('');

    if (totalRechazados > 0) {
      console.log('⚠️  PROBLEMA DETECTADO:');
      console.log(`   ${totalRechazados} documentos fueron rechazados porque NO existen en el Excel`);
      console.log('');
      console.log('POSIBLES CAUSAS:');
      console.log('1. El Excel SS339586_Final_v2 está incompleto');
      console.log('2. Los documentos son de otro periodo/proyecto');
      console.log('3. Error en la extracción de campos (expediente, acción, grupo)');
      console.log('4. Formato diferente de expedientes (ej: con/sin prefijos)');
      console.log('');
      console.log('ACCIONES RECOMENDADAS:');
      console.log('1. Verificar manualmente DOC_001 y DOC_002');
      console.log('2. Comparar expedientes extraídos vs Excel');
      console.log('3. Verificar si el Excel de referencia es el correcto');
      console.log('4. Procesar 10 documentos más para ver patrón');
      console.log('');
    }

    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

checkCoverage();
