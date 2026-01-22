/**
 * Verificar que el sistema tenga todas las piezas configuradas
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';

config({ path: '.env.production', override: true });

async function checkConfiguration() {
  console.log('🔍 VERIFICANDO CONFIGURACIÓN COMPLETA DEL SISTEMA\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Excel de VALIDACIÓN (referencia)
    console.log('1️⃣ EXCEL DE VALIDACIÓN (Datos de Referencia)');
    console.log('   Propósito: Contrastar datos extraídos vs. datos reales del cliente\n');

    const refCount = await sql`
      SELECT COUNT(*) as total,
             source_file,
             MAX(created_at) as uploaded_at
      FROM reference_data
      WHERE is_active = true
      GROUP BY source_file
      ORDER BY MAX(created_at) DESC
      LIMIT 1
    `;

    if (refCount.rows.length > 0) {
      const ref = refCount.rows[0];
      console.log(`   ✅ CARGADO`);
      console.log(`   📁 Archivo: ${ref.source_file}`);
      console.log(`   📊 Registros: ${ref.total}`);
      console.log(`   📅 Subido: ${new Date(ref.uploaded_at).toLocaleString()}`);
      console.log();

      // Mostrar algunos expedientes de ejemplo
      const samples = await sql`
        SELECT form_identifier
        FROM reference_data
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 3
      `;
      console.log(`   📋 Ejemplos de expedientes:`);
      samples.rows.forEach((row, idx) => {
        console.log(`      ${idx + 1}. ${row.form_identifier}`);
      });
      console.log();
    } else {
      console.log(`   ❌ NO CARGADO`);
      console.log(`   🔧 Sube el Excel en: /admin/excel-management`);
      console.log();
    }

    // 2. Excel de PLANTILLA (template)
    console.log('2️⃣ EXCEL DE PLANTILLA (Formato de Salida)');
    console.log('   Propósito: Definir estructura del Excel de exportación\n');

    // Verificar en column_mappings si hay configuración activa
    const templateCheck = await sql`
      SELECT id, mapping_name, created_at,
             jsonb_array_length(mappings) as total_fields
      FROM column_mappings
      WHERE is_active = true
      LIMIT 1
    `;

    if (templateCheck.rows.length > 0) {
      const tmpl = templateCheck.rows[0];
      console.log(`   ✅ CONFIGURADO`);
      console.log(`   📁 Configuración: ${tmpl.mapping_name}`);
      console.log(`   📊 Campos mapeados: ${tmpl.total_fields}`);
      console.log(`   📅 Creado: ${new Date(tmpl.created_at).toLocaleString()}`);
      console.log();
    } else {
      console.log(`   ⚠️  NO CONFIGURADO (o solo en localStorage)`);
      console.log(`   🔧 Configura en: /admin/column-mapping`);
      console.log();
    }

    // 3. MAPEO DE COLUMNAS
    console.log('3️⃣ MAPEO DE COLUMNAS (Campo FUNDAE → Columna Excel)');
    console.log('   Propósito: Definir qué campo va en qué columna del Excel de salida\n');

    if (templateCheck.rows.length > 0) {
      const mappingDetail = await sql`
        SELECT mappings
        FROM column_mappings
        WHERE is_active = true
        LIMIT 1
      `;

      if (mappingDetail.rows.length > 0) {
        const mappings = mappingDetail.rows[0].mappings;
        console.log(`   ✅ CONFIGURADO`);
        console.log(`   📋 Ejemplo de mapeos:`);

        // Mostrar primeros 5 mapeos
        const firstFive = mappings.slice(0, 5);
        firstFive.forEach((m: any) => {
          console.log(`      ${m.fundaeField.padEnd(25)} → Columna ${m.excelColumn} (${m.excelColumnName})`);
        });

        if (mappings.length > 5) {
          console.log(`      ... y ${mappings.length - 5} más`);
        }
        console.log();
      }
    } else {
      console.log(`   ⚠️  NO CONFIGURADO`);
      console.log();
    }

    // 4. RESUMEN DEL FLUJO
    console.log('═══════════════════════════════════════════════');
    console.log('📊 FLUJO COMPLETO DEL SISTEMA');
    console.log('═══════════════════════════════════════════════\n');

    const hasValidation = refCount.rows.length > 0;
    const hasTemplate = templateCheck.rows.length > 0;

    console.log('PASO 1: Subir PDF');
    console.log('   ↓');
    console.log('PASO 2: IA extrae datos del formulario FUNDAE');
    console.log('   ↓');
    console.log(`PASO 3: Validación cruzada con Excel ${hasValidation ? '✅' : '❌'}`);
    console.log(`   → Busca expediente en ${refCount.rows[0]?.total || 0} registros`);
    console.log(`   → Compara todos los campos`);
    console.log(`   → Marca discrepancias`);
    console.log('   ↓');
    console.log(`PASO 4: Exportar a Excel del cliente ${hasTemplate ? '✅' : '⚠️'}`);
    console.log(`   → Usa plantilla con estructura del cliente`);
    console.log(`   → Aplica mapeo de columnas configurado`);
    console.log(`   → Genera Excel listo para entregar`);
    console.log();

    // 5. ESTADO FINAL
    console.log('═══════════════════════════════════════════════');
    console.log('🎯 ESTADO GENERAL');
    console.log('═══════════════════════════════════════════════\n');

    if (hasValidation && hasTemplate) {
      console.log('✅ SISTEMA COMPLETO - Todo configurado');
      console.log('🚀 Listo para procesar formularios end-to-end');
    } else if (hasValidation) {
      console.log('⚠️  SISTEMA PARCIAL');
      console.log('✅ Validación cruzada: Funcionando');
      console.log('⚠️  Exportación: Falta configurar plantilla y mapeo');
      console.log();
      console.log('🔧 PARA COMPLETAR:');
      console.log('   1. Ve a https://www.verbadocpro.eu/admin/excel-management');
      console.log('   2. Sube el Excel de plantilla del cliente');
      console.log('   3. Ve a https://www.verbadocpro.eu/admin/column-mapping');
      console.log('   4. Configura el mapeo de columnas');
    } else {
      console.log('❌ SISTEMA INCOMPLETO');
      console.log('   Falta configurar todo');
    }
    console.log();

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }
}

checkConfiguration();
