require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkStructure() {
  try {
    console.log('\n🔍 VERIFICANDO TABLA unprocessable_documents...\n');

    // Ver columnas
    const cols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'unprocessable_documents'
      ORDER BY ordinal_position
    `;

    console.log('━━━ COLUMNAS DE unprocessable_documents ━━━');
    if (cols.rows.length === 0) {
      console.log('❌ LA TABLA NO EXISTE\n');
    } else {
      cols.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
      console.log('');
    }

    // Ver si existe la función
    const func = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_name = 'add_unprocessable_document'
    `;

    console.log('━━━ FUNCIÓN add_unprocessable_document ━━━');
    if (func.rows.length === 0) {
      console.log('❌ LA FUNCIÓN NO EXISTE\n');
    } else {
      console.log('✅ LA FUNCIÓN SÍ EXISTE\n');
    }

    // Probar inserción manual
    console.log('━━━ PROBANDO INSERCIÓN MANUAL ━━━');
    try {
      const userId = (await sql`SELECT id FROM users WHERE email = 'test@test.eu'`).rows[0].id;

      const testResult = await sql`
        SELECT add_unprocessable_document(
          ${userId}::UUID,
          'TEST_DOCUMENTO.pdf'::VARCHAR,
          'test'::VARCHAR,
          'Prueba de inserción'::TEXT,
          '{}'::JSONB,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        )
      `;

      console.log('✅ Inserción de prueba EXITOSA');
      console.log(`   ID generado: ${testResult.rows[0].add_unprocessable_document}\n`);

      // Eliminar el registro de prueba
      await sql`
        DELETE FROM unprocessable_documents
        WHERE filename = 'TEST_DOCUMENTO.pdf'
      `;
      console.log('✅ Registro de prueba eliminado\n');

    } catch (insertError) {
      console.error('❌ ERROR EN INSERCIÓN:', insertError.message);
      console.error(insertError.stack);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkStructure();
