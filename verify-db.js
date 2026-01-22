/**
 * Script para verificar reference_data directamente en la base de datos
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function verifyDatabase() {
  console.log('==========================================');
  console.log('VERIFICACIÓN DE REFERENCE_DATA EN BD');
  console.log('==========================================\n');

  try {
    // QUERY 1: Total de registros
    console.log('📊 QUERY 1: Total de registros\n');
    const q1 = await sql`
      SELECT
        COUNT(*) as total_registros,
        COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
        MIN(uploaded_at) as primer_upload,
        MAX(uploaded_at) as ultimo_upload,
        COUNT(DISTINCT source_file) as archivos_distintos
      FROM reference_data
    `;
    console.log('Resultado:');
    console.log(q1.rows[0]);
    console.log('\n');

    if (q1.rows[0].total_registros === '0') {
      console.log('❌ NO HAY DATOS en reference_data');
      console.log('⚠️  El Excel SS339586_Final_v2 NO está cargado en la BD\n');
      console.log('💡 SOLUCIÓN: Necesitas subir el Excel desde la interfaz web:');
      console.log('   1. Ir a https://www.verbadocpro.eu/reference-data');
      console.log('   2. Subir el archivo SS339586_Final_v2.xlsx');
      console.log('   3. Esperar a que procese las ~1290 filas\n');
      return;
    }

    // QUERY 2: Archivos cargados
    console.log('📂 QUERY 2: Archivos Excel cargados\n');
    const q2 = await sql`
      SELECT
        source_file,
        COUNT(*) as filas,
        uploaded_at,
        is_active
      FROM reference_data
      GROUP BY source_file, uploaded_at, is_active
      ORDER BY uploaded_at DESC
    `;
    console.log('Resultado:');
    q2.rows.forEach(row => {
      console.log(`  - ${row.source_file}: ${row.filas} filas (activo: ${row.is_active})`);
    });
    console.log('\n');

    // QUERY 3: CRÍTICA - Verificar columnas
    console.log('🔥 QUERY 3: Verificar nombres de columnas\n');
    const q3 = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN data ? 'D-EXPEDIENTE' THEN 1 END) as con_d_expediente,
        COUNT(CASE WHEN data ? 'D_COD_ACCION' THEN 1 END) as con_d_cod_accion,
        COUNT(CASE WHEN data ? 'D_COD_GRUPO' THEN 1 END) as con_d_cod_grupo,
        COUNT(CASE WHEN data ? 'numero_expediente' THEN 1 END) as con_numero_expediente,
        COUNT(CASE WHEN data ? 'expediente' THEN 1 END) as con_expediente
      FROM reference_data
      WHERE is_active = true
    `;
    console.log('Resultado:');
    console.log(q3.rows[0]);
    console.log('\n');

    const hasCorrectColumns =
      parseInt(q3.rows[0].con_d_expediente) > 0 &&
      parseInt(q3.rows[0].con_d_cod_accion) > 0 &&
      parseInt(q3.rows[0].con_d_cod_grupo) > 0;

    if (!hasCorrectColumns) {
      console.log('⚠️  LAS COLUMNAS NO TIENEN LOS NOMBRES ESPERADOS');
      console.log('   Esperado: D-EXPEDIENTE, D_COD_ACCION, D_COD_GRUPO');
      console.log('   Vamos a ver qué columnas existen realmente...\n');
    } else {
      console.log('✅ Las columnas tienen los nombres correctos!\n');
    }

    // QUERY 4: Ver un registro de ejemplo
    console.log('📄 QUERY 4: Registro de ejemplo\n');
    const q4 = await sql`
      SELECT
        id,
        form_identifier,
        data,
        source_file,
        uploaded_at
      FROM reference_data
      WHERE is_active = true
      LIMIT 1
    `;
    if (q4.rows.length > 0) {
      console.log('Form identifier:', q4.rows[0].form_identifier);
      console.log('Source file:', q4.rows[0].source_file);
      console.log('Data (primeras claves):');
      const dataKeys = Object.keys(q4.rows[0].data).slice(0, 10);
      dataKeys.forEach(key => {
        console.log(`  - ${key}: ${q4.rows[0].data[key]}`);
      });
      console.log('\n');
    }

    // QUERY 5: Ver todas las columnas que existen
    console.log('🔑 QUERY 5: Nombres de columnas reales (primeras 20)\n');
    const q5 = await sql`
      SELECT DISTINCT jsonb_object_keys(data) as columna
      FROM reference_data
      WHERE is_active = true
      LIMIT 20
    `;
    console.log('Columnas encontradas:');
    q5.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.columna}`);
    });
    console.log('\n');

    // QUERY 6: Ver primeros 5 registros con los campos críticos
    console.log('📋 QUERY 6: Primeros 5 registros con campos críticos\n');
    const q6 = await sql`
      SELECT
        data->>'D-EXPEDIENTE' as expediente,
        data->>'D_COD_ACCION' as accion,
        data->>'D_COD_GRUPO' as grupo
      FROM reference_data
      WHERE is_active = true
      LIMIT 5
    `;
    console.log('Resultado:');
    q6.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. Exp: ${row.expediente}, Acc: ${row.accion}, Grp: ${row.grupo}`);
    });
    console.log('\n');

    // QUERY 7: Verificar RLS policies
    console.log('🔒 QUERY 7: Políticas RLS (Row Level Security)\n');
    try {
      const q7 = await sql`
        SELECT
          policyname,
          cmd,
          qual
        FROM pg_policies
        WHERE tablename = 'reference_data'
      `;
      console.log('Políticas encontradas:');
      if (q7.rows.length === 0) {
        console.log('  (ninguna)\n');
      } else {
        q7.rows.forEach(row => {
          console.log(`  - ${row.policyname} (${row.cmd})`);
          console.log(`    Condición: ${row.qual}`);
        });
        console.log('\n');
      }
    } catch (rlsError) {
      console.log('  ⚠️  No se pudo consultar RLS policies (puede ser normal)\n');
    }

    console.log('==========================================');
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

verifyDatabase();
