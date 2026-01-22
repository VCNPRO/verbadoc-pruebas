/**
 * Test de exportación: Desde PDF procesado hasta Excel final
 * Usa la plantilla FUNDAE oficial y genera un Excel de salida
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.production', override: true });

// Mapeo de campos FUNDAE → Columnas Excel
// Este es el mapeo que debería estar configurado
const FUNDAE_TO_EXCEL_MAPPING = [
  // Sección I: Datos identificativos
  { fundaeField: 'expediente', excelColumn: 'A', excelColumnName: 'Nº Expediente' },
  { fundaeField: 'cif', excelColumn: 'B', excelColumnName: 'CIF' },
  { fundaeField: 'denominacion_aaff', excelColumn: 'C', excelColumnName: 'Denominación AAFF' },
  { fundaeField: 'modalidad', excelColumn: 'D', excelColumnName: 'Modalidad' },
  { fundaeField: 'perfil', excelColumn: 'E', excelColumnName: 'Perfil' },
  { fundaeField: 'num_accion', excelColumn: 'F', excelColumnName: 'Nº Acción' },
  { fundaeField: 'num_grupo', excelColumn: 'G', excelColumnName: 'Nº Grupo' },

  // Sección II: Datos del participante
  { fundaeField: 'edad', excelColumn: 'H', excelColumnName: 'Edad' },
  { fundaeField: 'sexo', excelColumn: 'I', excelColumnName: 'Sexo' },
  { fundaeField: 'titulacion', excelColumn: 'J', excelColumnName: 'Titulación' },
  { fundaeField: 'lugar_trabajo', excelColumn: 'K', excelColumnName: 'Lugar Trabajo' },
  { fundaeField: 'categoria_profesional', excelColumn: 'L', excelColumnName: 'Categoría Profesional' },
  { fundaeField: 'horario_curso', excelColumn: 'M', excelColumnName: 'Horario Curso' },
  { fundaeField: 'porcentaje_jornada', excelColumn: 'N', excelColumnName: '% Jornada' },
  { fundaeField: 'tamano_empresa', excelColumn: 'O', excelColumnName: 'Tamaño Empresa' },

  // Sección III: Valoraciones (ejemplo con las principales)
  { fundaeField: 'valoracion_1_1', excelColumn: 'P', excelColumnName: 'Val 1.1 - Organización' },
  { fundaeField: 'valoracion_2_1', excelColumn: 'Q', excelColumnName: 'Val 2.1 - Contenidos' },
  { fundaeField: 'valoracion_3_1', excelColumn: 'R', excelColumnName: 'Val 3.1 - Duración' },
  { fundaeField: 'valoracion_4_1_formadores', excelColumn: 'S', excelColumnName: 'Val 4.1 - Formadores' },
  { fundaeField: 'valoracion_5_1', excelColumn: 'T', excelColumnName: 'Val 5.1 - Medios didácticos' },
  { fundaeField: 'valoracion_6_1', excelColumn: 'U', excelColumnName: 'Val 6.1 - Instalaciones' },
  { fundaeField: 'valoracion_9_1', excelColumn: 'V', excelColumnName: 'Val 9.1 - Mercado trabajo' },
  { fundaeField: 'valoracion_10', excelColumn: 'W', excelColumnName: 'Satisfacción General' },
  { fundaeField: 'recomendaria_curso', excelColumn: 'X', excelColumnName: 'Recomendaría' },

  // Fecha
  { fundaeField: 'fecha_cumplimentacion', excelColumn: 'Y', excelColumnName: 'Fecha' },
];

async function testExportToExcel() {
  console.log('📊 TEST DE EXPORTACIÓN A EXCEL\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Obtener la última extracción procesada
    console.log('1️⃣ Obteniendo última extracción procesada...');
    const extraction = await sql`
      SELECT id, filename, extracted_data, created_at
      FROM extraction_results
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (extraction.rows.length === 0) {
      console.log('❌ No hay extracciones en la BD');
      console.log('   Ejecuta primero: npx tsx test-full-flow.ts');
      return;
    }

    const data = extraction.rows[0];
    console.log('✅ Extracción encontrada');
    console.log(`   ID: ${data.id}`);
    console.log(`   Archivo: ${data.filename}`);
    console.log(`   Fecha: ${new Date(data.created_at).toLocaleString()}`);
    console.log();

    const extractedData = data.extracted_data;

    // 2. Crear Excel según el mapeo
    console.log('2️⃣ Creando Excel con estructura configurada...');

    // Crear workbook
    const workbook = XLSX.utils.book_new();

    // Crear hoja con headers
    const headers = FUNDAE_TO_EXCEL_MAPPING.map(m => m.excelColumnName);
    const worksheetData: any[][] = [headers];

    // Agregar fila con los datos extraídos
    const row: any[] = [];
    FUNDAE_TO_EXCEL_MAPPING.forEach(mapping => {
      const value = extractedData[mapping.fundaeField];
      row.push(value !== undefined && value !== null ? value : '');
    });
    worksheetData.push(row);

    // Crear worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Ajustar anchos de columnas
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 15) }));
    worksheet['!cols'] = colWidths;

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Formularios FUNDAE');

    console.log('✅ Excel creado con éxito');
    console.log(`   Columnas: ${headers.length}`);
    console.log(`   Filas de datos: 1`);
    console.log();

    // 3. Guardar archivo
    const outputDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `FUNDAE_Export_${timestamp}.xlsx`;
    const filepath = path.join(outputDir, filename);

    XLSX.writeFile(workbook, filepath);

    console.log('3️⃣ Archivo guardado');
    console.log(`   📁 Ruta: ${filepath}`);
    console.log();

    // 4. Mostrar preview de los datos exportados
    console.log('4️⃣ Preview de datos exportados:\n');
    console.log('   Campo                          | Valor Exportado');
    console.log('   ' + '─'.repeat(70));

    FUNDAE_TO_EXCEL_MAPPING.slice(0, 15).forEach(mapping => {
      const value = extractedData[mapping.fundaeField];
      const valueStr = String(value || 'N/A').substring(0, 35);
      const fieldStr = mapping.fundaeField.padEnd(30);
      console.log(`   ${fieldStr} | ${valueStr}`);
    });

    if (FUNDAE_TO_EXCEL_MAPPING.length > 15) {
      console.log(`   ... y ${FUNDAE_TO_EXCEL_MAPPING.length - 15} campos más`);
    }
    console.log();

    // 5. Resumen
    console.log('═══════════════════════════════════════════════');
    console.log('🎉 EXPORTACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`✅ Excel generado: ${filename}`);
    console.log(`✅ Total campos exportados: ${FUNDAE_TO_EXCEL_MAPPING.length}`);
    console.log(`✅ Formato: Listo para entregar al cliente`);
    console.log();
    console.log('📂 Abre el archivo Excel en:');
    console.log(`   ${filepath}`);
    console.log();

    // 6. Verificar si hay mapeo en BD
    console.log('6️⃣ Verificando configuración del sistema...\n');

    const mappingCheck = await sql`
      SELECT COUNT(*) as total
      FROM column_mappings
      WHERE is_active = true
    `;

    const hasMappingInDB = parseInt(mappingCheck.rows[0].total) > 0;

    if (hasMappingInDB) {
      console.log('✅ Mapeo guardado en BD - El sistema usará la configuración guardada');
    } else {
      console.log('⚠️  Mapeo NO guardado en BD');
      console.log('   El sistema usó el mapeo hardcoded de este script');
      console.log('   Para guardar el mapeo:');
      console.log('   1. Ve a https://www.verbadocpro.eu/admin/column-mapping');
      console.log('   2. Configura los campos');
      console.log('   3. Haz click en "Guardar Mapeo"');
    }
    console.log();

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

testExportToExcel();
