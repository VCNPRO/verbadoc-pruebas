/**
 * Script para verificar la última extracción de formulario FUNDAE
 */

import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Cargar variables de entorno de producción
if (fs.existsSync('.env.production')) {
  console.log('📦 Usando variables de producción');
  dotenv.config({ path: '.env.production' });
} else {
  console.log('📦 Usando variables locales');
  dotenv.config({ path: '.env.local' });
}

async function checkLatestExtraction() {
  try {
    console.log('🔍 Buscando última extracción...\n');

    // Buscar la extracción más reciente
    const result = await sql`
      SELECT
        id,
        filename,
        validation_status,
        created_at,
        extracted_data,
        model_used,
        processing_time_ms,
        confidence_score,
        excel_validation_status,
        rejection_reason
      FROM extraction_results
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      console.log('❌ No se encontraron extracciones');
      process.exit(0);
    }

    const extraction = result.rows[0];

    console.log('📄 ÚLTIMA EXTRACCIÓN REGISTRADA:');
    console.log('================================');
    console.log('ID:', extraction.id);
    console.log('Archivo:', extraction.filename);
    console.log('Estado validación:', extraction.validation_status);
    console.log('Fecha:', new Date(extraction.created_at).toLocaleString('es-ES'));
    console.log('Modelo usado:', extraction.model_used || 'No especificado');
    console.log('Tiempo procesamiento:', extraction.processing_time_ms ? `${extraction.processing_time_ms}ms` : 'No registrado');
    console.log('Confianza:', extraction.confidence_score ? `${(extraction.confidence_score * 100).toFixed(1)}%` : 'No registrado');
    console.log('Validación Excel:', extraction.excel_validation_status || 'No validado');
    if (extraction.rejection_reason) {
      console.log('Motivo rechazo:', extraction.rejection_reason);
    }
    console.log('');

    if (extraction.extracted_data) {
      const data = extraction.extracted_data;
      console.log('📋 DATOS EXTRAÍDOS (Campos FUNDAE clave):');
      console.log('==========================================');

      // Sección I - Datos identificativos
      console.log('\n🔹 SECCIÓN I - Datos Identificativos:');
      console.log('  Expediente:', data.expediente || '❌ NO EXTRAÍDO');
      console.log('  CIF:', data.cif || '❌ NO EXTRAÍDO');
      console.log('  Denominación AAFF:', data.denominacion_aaff || '❌ NO EXTRAÍDO');
      console.log('  Perfil:', data.perfil || '❌ NO EXTRAÍDO');
      console.log('  Modalidad:', data.modalidad || '❌ NO EXTRAÍDO');

      // Sección II - Clasificación participante
      console.log('\n🔹 SECCIÓN II - Clasificación Participante:');
      console.log('  Edad:', data.edad || '❌ NO EXTRAÍDO');
      console.log('  Sexo:', data.sexo || '❌ NO EXTRAÍDO');
      console.log('  Titulación:', data.titulacion || '❌ NO EXTRAÍDO');
      console.log('  Lugar trabajo:', data.lugar_trabajo || '❌ NO EXTRAÍDO');
      console.log('  Categoría profesional:', data.categoria_profesional || '❌ NO EXTRAÍDO');

      // Sección III - Muestra de valoraciones
      console.log('\n🔹 SECCIÓN III - Valoraciones (muestra):');
      console.log('  Valoración 1.1:', data.valoracion_1_1 || '❌ NO EXTRAÍDO');
      console.log('  Valoración 2.1:', data.valoracion_2_1 || '❌ NO EXTRAÍDO');
      console.log('  Valoración 9.1:', data.valoracion_9_1 || '❌ NO EXTRAÍDO');
      console.log('  Satisfacción general:', data.valoracion_10 || '❌ NO EXTRAÍDO');

      // Resumen
      const totalFields = Object.keys(data).length;
      const extractedFields = Object.values(data).filter(v => v !== null && v !== undefined && v !== '').length;

      console.log('\n📊 RESUMEN:');
      console.log('===========');
      console.log('Total campos en respuesta:', totalFields);
      console.log('Campos con datos:', extractedFields);
      console.log('Campos vacíos:', totalFields - extractedFields);
      console.log('Tasa de extracción:', Math.round((extractedFields / totalFields) * 100) + '%');

      // Mostrar todos los campos disponibles
      console.log('\n📝 TODOS LOS CAMPOS DISPONIBLES:');
      console.log('================================');
      Object.keys(data).sort().forEach((key, index) => {
        const value = data[key];
        const valueStr = value ? String(value).substring(0, 40) : '(vacío)';
        console.log(`${(index + 1).toString().padStart(2, '0')}. ${key.padEnd(30)} = ${valueStr}`);
      });

    } else {
      console.log('⚠️ No hay datos extraídos guardados');
    }

    // Buscar errores de validación
    console.log('\n\n🔍 ERRORES DE VALIDACIÓN:');
    console.log('==========================');

    const errorsResult = await sql`
      SELECT
        field_name,
        error_type,
        error_message,
        severity,
        invalid_value,
        suggested_correction,
        status
      FROM validation_errors
      WHERE extraction_id = ${extraction.id}
      ORDER BY severity DESC, field_name
    `;

    if (errorsResult.rows.length > 0) {
      console.log(`Total errores encontrados: ${errorsResult.rows.length}\n`);
      errorsResult.rows.forEach((error, index) => {
        const icon = error.severity === 'error' ? '❌' : error.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${index + 1}. ${error.field_name}`);
        console.log(`   Tipo: ${error.error_type}`);
        console.log(`   Mensaje: ${error.error_message}`);
        if (error.invalid_value) {
          console.log(`   Valor inválido: ${error.invalid_value}`);
        }
        if (error.suggested_correction) {
          console.log(`   Corrección sugerida: ${error.suggested_correction}`);
        }
        console.log(`   Estado: ${error.status}`);
        console.log('');
      });
    } else {
      console.log('✅ Sin errores de validación registrados');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLatestExtraction();
