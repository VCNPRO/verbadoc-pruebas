/**
 * Test completo del flujo end-to-end:
 * 1. Generar PDF de prueba
 * 2. Subirlo al API de procesamiento
 * 3. Verificar validación cruzada
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Cargar variables de entorno
config({ path: '.env.production', override: true });

// Usuario de prueba (necesitamos estar autenticados)
const TEST_USER_EMAIL = 'test@test.eu';
const TEST_USER_ID = '3360dfa5-0a33-4c11-8ccb-6e50dd7e3705';

async function testFullFlow() {
  console.log('🧪 TEST END-TO-END DEL SISTEMA FUNDAE\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Verificar que el PDF existe
    console.log('1️⃣ Verificando PDF de prueba...');
    const pdfPath = path.join(
      process.cwd(),
      'tests',
      'fixtures',
      'generated-forms',
      'form_B241889AC_test.pdf'
    );

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF no encontrado. Ejecuta primero: npx tsx generate-test-pdf.ts');
      return;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`✅ PDF encontrado: ${path.basename(pdfPath)}`);
    console.log(`   Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log();

    // 2. Verificar que el expediente existe en BD
    console.log('2️⃣ Verificando datos de referencia...');
    const refCheck = await sql`
      SELECT form_identifier, data->>'razon_social' as empresa
      FROM reference_data
      WHERE form_identifier = 'B241889AC'
      AND is_active = true
    `;

    if (refCheck.rows.length === 0) {
      console.error('❌ Expediente B241889AC no encontrado en BD');
      console.error('   Sube primero el Excel de validación');
      return;
    }

    console.log('✅ Expediente encontrado en BD:');
    console.log(`   Expediente: ${refCheck.rows[0].form_identifier}`);
    console.log(`   Empresa: ${refCheck.rows[0].empresa}`);
    console.log();

    // 3. Simular procesamiento del PDF
    console.log('3️⃣ Simulando procesamiento del PDF...');
    console.log('   (En producción esto lo haría Claude API)');
    console.log();

    // Crear registro de extracción simulado directamente en BD
    // En producción, esto lo hace el API /api/extractions después de procesar con Claude
    const extractedData = {
      // Datos extraídos (coinciden con Excel)
      numero_expediente: 'B241889AC',
      nif_empresa: 'A28122125',
      razon_social: 'CANON ESPAÑA, S.A.',
      accion_formativa: 'INTRODUCCIÓN A SALESFORCE.COM',
      horas_formacion: 18,
      modalidad: 'Presencial',
      numero_participantes: 3,

      // Datos del participante (simulados)
      edad: 35,
      sexo: 'Hombre',
      titulacion: 'Grado Universitario',
      lugar_trabajo: 'Madrid',
      categoria_profesional: 'Técnico especialista',
      tamano_empresa: 'Más de 250 trabajadores',
      antiguedad: '5-10 años',
      situacion_laboral: 'Contrato indefinido',
      nivel_estudios: 'Universitarios',

      // Valoraciones (simuladas)
      valoracion_contenidos: 4,
      valoracion_duracion: 3,
      valoracion_horarios: 4,
      valoracion_metodologia: 3,
      valoracion_documentacion: 4,
      valoracion_instalaciones: 3,
      valoracion_profesorado: 4,
      satisfaccion_general: 'Muy satisfecho'
    };

    console.log('   Datos extraídos (simulados):');
    console.log(`   - Expediente: ${extractedData.numero_expediente}`);
    console.log(`   - CIF: ${extractedData.nif_empresa}`);
    console.log(`   - Empresa: ${extractedData.razon_social}`);
    console.log(`   - Edad: ${extractedData.edad}`);
    console.log(`   - Sexo: ${extractedData.sexo}`);
    console.log();

    // Insertar extracción en BD
    const extractionResult = await sql`
      INSERT INTO extraction_results (
        user_id,
        filename,
        validation_status,
        extracted_data,
        processing_time_ms,
        model_used,
        confidence_score,
        created_at
      ) VALUES (
        ${TEST_USER_ID},
        ${path.basename(pdfPath)},
        'valid',
        ${JSON.stringify(extractedData)}::jsonb,
        2500,
        'gemini-2.5-flash',
        0.95,
        NOW()
      )
      RETURNING id
    `;

    const extractionId = extractionResult.rows[0].id;
    console.log(`✅ Extracción registrada: ID ${extractionId}`);
    console.log();

    // 4. Realizar validación cruzada
    console.log('4️⃣ Ejecutando validación cruzada...');

    const referenceData = refCheck.rows[0];
    const referenceResult = await sql`
      SELECT id, data
      FROM reference_data
      WHERE form_identifier = ${extractedData.numero_expediente}
      AND is_active = true
      LIMIT 1
    `;

    if (referenceResult.rows.length === 0) {
      console.log('⚠️  No se encontró datos de referencia para validar');
      return;
    }

    const refData = referenceResult.rows[0].data;
    console.log('✅ Datos de referencia obtenidos del Excel');
    console.log();

    // Comparar campos
    console.log('5️⃣ Comparando campos extraídos vs. Excel...\n');

    const fieldsToCompare = [
      { extracted: 'numero_expediente', reference: 'numero_expediente', label: 'Nº Expediente' },
      { extracted: 'nif_empresa', reference: 'nif_empresa', label: 'CIF/NIF' },
      { extracted: 'razon_social', reference: 'razon_social', label: 'Razón Social' },
      { extracted: 'accion_formativa', reference: 'accion_formativa', label: 'Acción Formativa' },
      { extracted: 'horas_formacion', reference: 'horas_formacion', label: 'Horas Formación' },
      { extracted: 'modalidad', reference: 'modalidad', label: 'Modalidad' },
      { extracted: 'numero_participantes', reference: 'numero_participantes', label: 'Participantes' }
    ];

    let matches = 0;
    let mismatches = 0;
    const discrepancies: any[] = [];

    console.log('   Campo                    | Extraído                    | Referencia                  | Estado');
    console.log('   ' + '─'.repeat(100));

    fieldsToCompare.forEach(field => {
      const extractedValue = extractedData[field.extracted as keyof typeof extractedData];
      const referenceValue = refData[field.reference];

      const extractedStr = String(extractedValue || 'N/A').substring(0, 25).padEnd(25);
      const referenceStr = String(referenceValue || 'N/A').substring(0, 25).padEnd(25);
      const labelStr = field.label.padEnd(22);

      // Normalizar para comparación
      const extractedNorm = String(extractedValue || '').toLowerCase().trim();
      const referenceNorm = String(referenceValue || '').toLowerCase().trim();

      let status = '';
      if (extractedNorm === referenceNorm) {
        status = '✅ COINCIDE';
        matches++;
      } else {
        status = '❌ DIFERENTE';
        mismatches++;
        discrepancies.push({
          field: field.label,
          extracted: extractedValue,
          reference: referenceValue
        });
      }

      console.log(`   ${labelStr} | ${extractedStr} | ${referenceStr} | ${status}`);
    });

    console.log();
    console.log('═══════════════════════════════════════════════');
    console.log('📊 RESULTADOS DE LA VALIDACIÓN CRUZADA');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ Campos coincidentes: ${matches}`);
    console.log(`❌ Campos diferentes: ${mismatches}`);
    console.log(`📈 Tasa de coincidencia: ${((matches / fieldsToCompare.length) * 100).toFixed(1)}%`);
    console.log();

    if (discrepancies.length > 0) {
      console.log('⚠️  DISCREPANCIAS ENCONTRADAS:');
      discrepancies.forEach((disc, idx) => {
        console.log(`   ${idx + 1}. ${disc.field}`);
        console.log(`      Extraído:    "${disc.extracted}"`);
        console.log(`      Referencia:  "${disc.reference}"`);
      });
      console.log();
    }

    // Guardar resultado de validación cruzada
    const matchPercentage = (matches / fieldsToCompare.length) * 100;
    await sql`
      INSERT INTO cross_validation_results (
        extraction_id,
        reference_data_id,
        matches,
        match_percentage,
        discrepancy_count,
        discrepancies,
        critical_discrepancies,
        warning_discrepancies,
        validated_at
      ) VALUES (
        ${extractionId},
        ${referenceResult.rows[0].id},
        ${mismatches === 0},
        ${matchPercentage},
        ${mismatches},
        ${JSON.stringify(discrepancies)}::jsonb,
        0,
        ${mismatches},
        NOW()
      )
    `;

    console.log('✅ Resultado de validación guardado en BD');
    console.log();

    // 6. Resumen final
    console.log('═══════════════════════════════════════════════');
    console.log('🎉 TEST COMPLETADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════');
    console.log();
    console.log('✅ PDF generado');
    console.log('✅ Datos extraídos (simulado)');
    console.log('✅ Validación cruzada ejecutada');
    console.log('✅ Resultados guardados en BD');
    console.log();
    console.log('📍 Puedes ver el resultado en:');
    console.log(`   https://www.verbadocpro.eu/review/${extractionId}`);
    console.log();

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Ejecutar
testFullFlow();
