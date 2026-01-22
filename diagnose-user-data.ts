/**
 * Diagnosticar problema de datos que reaparecen
 */

import { config } from 'dotenv';
import { sql } from '@vercel/postgres';

config({ path: '.env.production', override: true });

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO: ¿Por qué los datos reaparecen?\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Ver todos los usuarios
    console.log('1️⃣ USUARIOS REGISTRADOS:\n');
    const users = await sql`
      SELECT id, email, role, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    users.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Rol: ${user.role}`);
      console.log(`   Creado: ${new Date(user.created_at).toLocaleString()}`);
      console.log();
    });

    // 2. Ver todas las extracciones (de todos los usuarios)
    console.log('2️⃣ EXTRACCIONES EN LA BASE DE DATOS:\n');
    const extractions = await sql`
      SELECT
        e.id,
        e.filename,
        e.user_id,
        u.email as user_email,
        e.validation_status,
        e.created_at
      FROM extraction_results e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
      LIMIT 20
    `;

    if (extractions.rows.length === 0) {
      console.log('   ❌ No hay extracciones en la BD');
    } else {
      console.log(`   Total: ${extractions.rows.length} extracciones\n`);

      extractions.rows.forEach((ext, idx) => {
        console.log(`${idx + 1}. ${ext.filename}`);
        console.log(`   ID: ${ext.id}`);
        console.log(`   Usuario: ${ext.user_email || 'Usuario eliminado'}`);
        console.log(`   User ID: ${ext.user_id}`);
        console.log(`   Estado: ${ext.validation_status}`);
        console.log(`   Fecha: ${new Date(ext.created_at).toLocaleString()}`);
        console.log();
      });
    }

    // 3. Contar extracciones por usuario
    console.log('3️⃣ EXTRACCIONES POR USUARIO:\n');
    const countByUser = await sql`
      SELECT
        u.email,
        u.role,
        COUNT(e.id) as total_extracciones
      FROM users u
      LEFT JOIN extraction_results e ON u.id = e.user_id
      GROUP BY u.id, u.email, u.role
      ORDER BY total_extracciones DESC
    `;

    countByUser.rows.forEach(row => {
      console.log(`   ${row.email} (${row.role}): ${row.total_extracciones} extracciones`);
    });
    console.log();

    // 4. Explicar el problema
    console.log('═══════════════════════════════════════════════');
    console.log('🔍 EXPLICACIÓN DEL PROBLEMA');
    console.log('═══════════════════════════════════════════════\n');

    const adminUsers = users.rows.filter(u => u.role === 'admin');

    console.log('SITUACIÓN ACTUAL:');
    console.log(`   • ${users.rows.length} usuarios registrados`);
    console.log(`   • ${adminUsers.length} usuarios con rol ADMIN`);
    console.log(`   • ${extractions.rows.length} extracciones en BD\n`);

    if (adminUsers.length > 0) {
      console.log('⚠️  PROBLEMA IDENTIFICADO:');
      console.log('   Los usuarios ADMIN ven TODAS las extracciones de TODOS los usuarios.');
      console.log();
      console.log('   ¿Qué pasa cuando un ADMIN borra datos?');
      console.log('   1. Admin ve 10 formularios (suyos + de otros usuarios)');
      console.log('   2. Admin borra "todos"');
      console.log('   3. Sistema solo borra LOS SUYOS (por seguridad)');
      console.log('   4. Admin vuelve a entrar');
      console.log('   5. Sigue viendo los de otros usuarios');
      console.log();
      console.log('   USUARIOS ADMIN:');
      adminUsers.forEach(admin => {
        console.log(`   - ${admin.email}`);
      });
      console.log();
    }

    // 5. Solución
    console.log('═══════════════════════════════════════════════');
    console.log('✅ SOLUCIONES POSIBLES');
    console.log('═══════════════════════════════════════════════\n');

    console.log('OPCIÓN 1: Limpiar extracciones de prueba');
    console.log('   Borra las extracciones generadas durante testing');
    console.log('   Comando: npx tsx clean-test-data.ts');
    console.log();

    console.log('OPCIÓN 2: Cambiar comportamiento para admins');
    console.log('   Hacer que admins solo vean sus propias extracciones');
    console.log('   (o agregar un filtro explícito "Ver todas")');
    console.log();

    console.log('OPCIÓN 3: Agregar filtro por usuario en el UI');
    console.log('   Permitir al admin filtrar por usuario específico');
    console.log();

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }
}

diagnose();
