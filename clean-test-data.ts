/**
 * Limpiar todas las extracciones de prueba
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import readline from 'readline';

config({ path: '.env.production', override: true });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function cleanTestData() {
  console.log('🧹 LIMPIEZA DE DATOS DE PRUEBA\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Contar extracciones actuales
    const count = await sql`
      SELECT COUNT(*) as total FROM extraction_results
    `;
    const total = parseInt(count.rows[0].total);

    if (total === 0) {
      console.log('✅ No hay extracciones en la base de datos');
      console.log('   Ya está limpia\n');
      rl.close();
      return;
    }

    // 2. Mostrar extracciones que se borrarán
    console.log(`⚠️  Se encontraron ${total} extracciones:\n`);

    const extractions = await sql`
      SELECT
        e.id,
        e.filename,
        u.email,
        e.created_at
      FROM extraction_results e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
      LIMIT 10
    `;

    extractions.rows.forEach((ext, idx) => {
      console.log(`${idx + 1}. ${ext.filename}`);
      console.log(`   Usuario: ${ext.email}`);
      console.log(`   Fecha: ${new Date(ext.created_at).toLocaleString()}`);
      console.log();
    });

    if (total > 10) {
      console.log(`... y ${total - 10} más\n`);
    }

    // 3. Pedir confirmación
    const answer = await question('¿Borrar TODAS las extracciones? (escribe "SI" para confirmar): ');

    if (answer.trim().toUpperCase() !== 'SI') {
      console.log('\n❌ Operación cancelada\n');
      rl.close();
      return;
    }

    // 4. Borrar todas las extracciones
    console.log('\n🔥 Borrando extracciones...');

    // Primero borrar validation_errors (foreign key)
    const validationErrors = await sql`DELETE FROM validation_errors`;
    console.log(`   ✅ ${validationErrors.rowCount || 0} errores de validación eliminados`);

    // Luego borrar cross_validation_results
    const crossValidation = await sql`DELETE FROM cross_validation_results`;
    console.log(`   ✅ ${crossValidation.rowCount || 0} validaciones cruzadas eliminadas`);

    // Finalmente borrar extracciones
    const result = await sql`DELETE FROM extraction_results`;
    console.log(`   ✅ ${result.rowCount || 0} extracciones eliminadas`);

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 LIMPIEZA COMPLETADA');
    console.log('═══════════════════════════════════════════════\n');

    console.log('✅ Base de datos limpia');
    console.log('✅ Ahora puedes empezar con datos frescos');
    console.log();
    console.log('📝 PRÓXIMOS PASOS:');
    console.log('   1. Actualiza la página web (Ctrl+F5)');
    console.log('   2. Ve a https://www.verbadocpro.eu/review');
    console.log('   3. Deberías ver "No hay formularios"');
    console.log();

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  } finally {
    rl.close();
  }
}

cleanTestData();
