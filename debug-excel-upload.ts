/**
 * Script de diagnóstico para entender por qué el Excel no se guarda en BD
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';

// Cargar variables de entorno
config({ path: '.env.production' });

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO DEL EXCEL DE VALIDACIÓN\n');

  try {
    // 1. Verificar conexión a BD
    console.log('1️⃣ Verificando conexión a PostgreSQL...');
    const connectionTest = await sql`SELECT NOW() as current_time`;
    console.log('   ✅ Conexión exitosa:', connectionTest.rows[0].current_time);
    console.log();

    // 2. Verificar si existe la tabla reference_data
    console.log('2️⃣ Verificando tabla reference_data...');
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'reference_data'
    `;
    if (tableCheck.rows.length > 0) {
      console.log('   ✅ Tabla reference_data existe');
    } else {
      console.log('   ❌ Tabla reference_data NO EXISTE');
      return;
    }
    console.log();

    // 3. Verificar estructura de la tabla
    console.log('3️⃣ Verificando columnas de reference_data...');
    const columnsCheck = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'reference_data'
      ORDER BY ordinal_position
    `;
    console.log('   Columnas encontradas:');
    columnsCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    console.log();

    // 4. Contar registros totales
    console.log('4️⃣ Contando registros en reference_data...');
    const countResult = await sql`
      SELECT COUNT(*) as total FROM reference_data
    `;
    const total = parseInt(countResult.rows[0].total);
    console.log(`   📊 Total registros: ${total}`);
    console.log();

    if (total === 0) {
      console.log('   ⚠️  NO HAY REGISTROS EN LA BASE DE DATOS');
      console.log('   Posibles causas:');
      console.log('   - El Excel no se subió correctamente');
      console.log('   - Hubo un error al insertar en BD');
      console.log('   - El usuario no tiene permisos de admin');
      console.log();
    } else {
      // 5. Mostrar algunos ejemplos
      console.log('5️⃣ Mostrando primeros 5 registros...');
      const samples = await sql`
        SELECT
          form_identifier,
          source_file,
          created_at,
          uploaded_by
        FROM reference_data
        ORDER BY created_at DESC
        LIMIT 5
      `;
      samples.rows.forEach(row => {
        console.log(`   - ${row.form_identifier} | ${row.source_file} | ${row.created_at}`);
      });
      console.log();
    }

    // 6. Verificar usuarios y roles
    console.log('6️⃣ Verificando usuarios registrados...');
    const usersCheck = await sql`
      SELECT id, email, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `;
    console.log('   Usuarios encontrados:');
    usersCheck.rows.forEach(user => {
      console.log(`   - ${user.email} | Rol: ${user.role} | ID: ${user.id}`);
    });
    console.log();

    // 7. Verificar si hay registros borrados o inactivos
    console.log('7️⃣ Verificando registros inactivos...');
    const inactiveCheck = await sql`
      SELECT COUNT(*) as total
      FROM reference_data
      WHERE is_active = false
    `;
    const inactiveCount = parseInt(inactiveCheck.rows[0].total);
    if (inactiveCount > 0) {
      console.log(`   ⚠️  Hay ${inactiveCount} registros marcados como inactivos`);
    } else {
      console.log('   ✅ No hay registros inactivos');
    }
    console.log();

    // 8. Conclusión
    console.log('📋 CONCLUSIÓN:');
    if (total === 0) {
      console.log('   ❌ El Excel NO se ha guardado en la base de datos');
      console.log('   🔧 SOLUCIÓN: Vuelve a subir el Excel desde la aplicación web');
      console.log('   📍 URL: https://www.verbadocpro.eu/admin/excel-management');
      console.log();
      console.log('   💡 IMPORTANTE: Asegúrate de estar logueado como ADMIN');
    } else {
      console.log(`   ✅ Excel guardado correctamente con ${total} registros`);
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error('   Stack:', error.stack);
  }
}

diagnose();
