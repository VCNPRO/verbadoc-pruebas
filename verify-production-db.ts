/**
 * Verificar que el Excel está en la BD de PRODUCCIÓN
 * Este script usa la misma conexión que el API de producción
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';

// Cargar variables de PRODUCCIÓN
config({ path: '.env.production', override: true });

async function verifyProduction() {
  console.log('🔍 VERIFICANDO BASE DE DATOS DE PRODUCCIÓN\n');

  try {
    // 1. Mostrar qué BD estamos usando (primeros caracteres)
    const dbUrl = process.env.POSTGRES_URL || 'NO CONFIGURADA';
    console.log('📡 Conectando a:', dbUrl.substring(0, 50) + '...');
    console.log();

    // 2. Verificar conexión
    console.log('⏳ Conectando a PostgreSQL...');
    const timeCheck = await sql`SELECT NOW() as time`;
    console.log('✅ Conectado exitosamente:', timeCheck.rows[0].time);
    console.log();

    // 3. Contar registros totales
    console.log('📊 Contando registros en reference_data...');
    const countResult = await sql`
      SELECT COUNT(*) as total FROM reference_data WHERE is_active = true
    `;
    const total = parseInt(countResult.rows[0].total);
    console.log(`   Total: ${total} registros`);
    console.log();

    if (total > 0) {
      // 4. Mostrar algunos ejemplos
      console.log('📋 Primeros 5 expedientes:');
      const samples = await sql`
        SELECT
          form_identifier,
          source_file,
          data->>'cif' as cif,
          data->>'denominacion_aaff' as empresa,
          created_at
        FROM reference_data
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 5
      `;

      samples.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. ${row.form_identifier}`);
        console.log(`   CIF: ${row.cif || 'N/A'}`);
        console.log(`   Empresa: ${row.empresa || 'N/A'}`);
        console.log(`   Archivo: ${row.source_file}`);
        console.log(`   Fecha: ${row.created_at}`);
        console.log();
      });

      // 5. Buscar el expediente B241889AC
      console.log('🔍 Buscando expediente B241889AC...');
      const searchResult = await sql`
        SELECT
          form_identifier,
          data->>'cif' as cif,
          data->>'denominacion_aaff' as empresa,
          data
        FROM reference_data
        WHERE form_identifier = 'B241889AC'
        AND is_active = true
        LIMIT 1
      `;

      if (searchResult.rows.length > 0) {
        const row = searchResult.rows[0];
        console.log('✅ ENCONTRADO:');
        console.log(`   Expediente: ${row.form_identifier}`);
        console.log(`   CIF: ${row.cif}`);
        console.log(`   Empresa: ${row.empresa}`);
        console.log(`   Datos completos:`, JSON.stringify(row.data, null, 2));
      } else {
        console.log('❌ No encontrado');
      }
      console.log();

      // 6. Conclusión
      console.log('═══════════════════════════════════════════════');
      console.log('✅ EXCEL CARGADO CORRECTAMENTE EN PRODUCCIÓN');
      console.log(`📊 ${total} expedientes disponibles para validación`);
      console.log('═══════════════════════════════════════════════');

    } else {
      console.log('❌ No hay registros en la base de datos de producción');
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    if (error.message.includes('connect')) {
      console.error('   Problema de conexión a la BD de producción');
      console.error('   Verifica las variables de entorno en .env.production');
    }
  }
}

verifyProduction();
