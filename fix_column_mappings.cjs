require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function fixMappings() {
  try {
    console.log('\n🔧 CORRIGIENDO NOMBRES DE CAMPOS EN COLUMN_MAPPINGS...\n');

    // Obtener la configuración actual
    const current = await sql`
      SELECT id, mappings FROM column_mappings
      WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.eu')
      AND is_active = true
      LIMIT 1
    `;

    if (current.rows.length === 0) {
      console.log('❌ No hay configuración activa');
      return;
    }

    const mappingId = current.rows[0].id;
    const mappings = current.rows[0].mappings;

    // Mapeo de nombres INCORRECTOS → CORRECTOS
    const corrections = {
      'Id_expediente': 'csv_fundae',
      'año': 'expediente',  // extraeremos el año del expediente si es necesario
      'num_expediente': 'numero_expediente',
      'd_expediente': 'expediente',
      'CIF': 'cif',
      'd_cod_aaff': 'num_accion',
      'd_cod_grupo': 'num_grupo',
      'd_nom_aaff': 'denominacion_aaff',
      // estos 4 ya están bien: modalidad, edad, sexo, titulacion
      'otra_titulación': 'titulacion_codigo',
      'codigo_postal': 'lugar_trabajo',  // no hay codigo_postal en los datos
      'Lugar_trabajo': 'lugar_trabajo',
      'Categoria_profesional': 'categoria_profesional',
      'Otra_categoria_profesional': 'categoria_profesional_otra',
      'Horario_curso': 'horario_curso',
      'Jornada': 'porcentaje_jornada',
      'Tamño_pyme': 'tamano_empresa',
      'Buena_organización': 'valoracion_1_1',
      'Num_alumnos_adecuado': 'valoracion_1_2',
      'Contenidos_segun_necesidaes': 'valoracion_2_1',
      'Contenidos_según_teoría_practica': 'valoracion_2_2',
      'Duración': 'valoracion_3_1',
      'Horario_favorable': 'valoracion_3_2',
      'Formador_facilitador': 'valoracion_4_1_formadores',
      'Tutor_facilitador': 'valoracion_4_1_tutores',
      'Tutor_conoce_tema': 'valoracion_4_2_formadores',
      'Medios_comprensibles': 'valoracion_5_1',
      'Medios_actualizados': 'valoracion_5_2',
      'Instalaciones_adecuadas': 'valoracion_6_1',
      'Medios_tecnicos': 'valoracion_6_2',
      'Teleformación_medios': 'valoracion_8_1',
      'Pruebas_evaluacion': 'valoracion_7_1',
      'Acreditación': 'valoracion_7_2',
      'Incorporación': 'valoracion_9_1',
      'Conocimientos_trabajo': 'valoracion_9_2',
      'Progresar_carrera': 'valoracion_9_3',
      'Desarrollo_personal': 'valoracion_9_4',
      'Reconocimiento_cualificación': 'valoracion_9_5',
      'Grado_satisfacción': 'valoracion_10',
      'Observaciones': 'sugerencias'
    };

    // Aplicar correcciones
    let corrected = 0;
    let unchanged = 0;

    mappings.forEach(mapping => {
      const oldField = mapping.fundaeField;

      // Si es campo_personalizado, manejar casos especiales
      if (oldField === 'campo_personalizado') {
        if (mapping.excelColumnName === 'F_CUMPLIMENTACION') {
          mapping.fundaeField = 'fecha_cumplimentacion';
          console.log(`  ✅ "${oldField}" (${mapping.excelColumnName}) → "fecha_cumplimentacion"`);
          corrected++;
        } else if (mapping.excelColumnName === 'Recomendaria_el_curso') {
          mapping.fundaeField = 'recomendaria_curso';
          console.log(`  ✅ "${oldField}" (${mapping.excelColumnName}) → "recomendaria_curso"`);
          corrected++;
        }
      } else if (corrections[oldField]) {
        mapping.fundaeField = corrections[oldField];
        console.log(`  ✅ "${oldField}" → "${corrections[oldField]}"`);
        corrected++;
      } else {
        console.log(`  ⏸️  "${oldField}" - sin cambios`);
        unchanged++;
      }
    });

    console.log(`\n📊 RESUMEN:`);
    console.log(`   Corregidos: ${corrected}`);
    console.log(`   Sin cambios: ${unchanged}`);
    console.log(`   Total: ${mappings.length}\n`);

    // Guardar cambios en la base de datos
    console.log('💾 Guardando cambios en la base de datos...\n');

    await sql`
      UPDATE column_mappings
      SET mappings = ${JSON.stringify(mappings)}::jsonb,
          updated_at = NOW()
      WHERE id = ${mappingId}
    `;

    console.log('✅ ¡Configuración actualizada correctamente!\n');

    // Verificar resultado
    console.log('🔍 Verificando nombres actualizados...\n');

    const updated = await sql`
      SELECT mappings FROM column_mappings WHERE id = ${mappingId}
    `;

    const updatedFields = updated.rows[0].mappings.map(m => m.fundaeField);
    console.log('Campos configurados ahora:');
    updatedFields.forEach((field, idx) => {
      console.log(`  ${idx + 1}. ${field}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

fixMappings();
