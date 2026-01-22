require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkMappings() {
  try {
    console.log('\n🔍 Verificando configuraciones de column_mappings...\n');

    // Buscar usuario test@test.eu
    const user = await sql`
      SELECT id, email FROM users WHERE email = 'test@test.eu' LIMIT 1
    `;

    if (user.rows.length === 0) {
      console.log('❌ Usuario test@test.eu no encontrado');
      return;
    }

    const userId = user.rows[0].id;
    console.log(`✅ Usuario encontrado: ${user.rows[0].email} (${userId})\n`);

    // Buscar configuraciones de mapeo
    const mappings = await sql`
      SELECT
        id,
        mapping_name,
        is_active,
        jsonb_array_length(mappings) as num_columns,
        created_at,
        updated_at
      FROM column_mappings
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    console.log(`📊 Configuraciones encontradas: ${mappings.rows.length}\n`);

    if (mappings.rows.length === 0) {
      console.log('❌ NO HAY CONFIGURACIONES DE MAPEO para este usuario');
      console.log('   Necesitas guardar la configuración en /admin/column-mapping\n');
    } else {
      mappings.rows.forEach((row, idx) => {
        console.log(`━━━ CONFIG ${idx + 1} ━━━`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Nombre: ${row.mapping_name}`);
        console.log(`  Activa: ${row.is_active ? 'SÍ' : 'NO'}`);
        console.log(`  Columnas: ${row.num_columns}`);
        console.log(`  Creada: ${row.created_at}`);
        console.log(`  Actualizada: ${row.updated_at}`);
        console.log('');
      });

      // Buscar la activa
      const active = mappings.rows.find(r => r.is_active);
      if (active) {
        console.log(`✅ Configuración ACTIVA encontrada:`);
        console.log(`   - ${active.num_columns} columnas`);
        console.log(`   - Nombre: ${active.mapping_name}\n`);
      } else {
        console.log('⚠️ NINGUNA configuración está ACTIVA');
        console.log('   Necesitas activar una configuración\n');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkMappings();
