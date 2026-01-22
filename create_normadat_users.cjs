require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

async function createNormadatUsers() {
  try {
    console.log('\n👥 GESTIÓN USUARIOS NORMADAT...\n');

    // Nuevos emails
    const newUsers = [
      'nmd_01@verbadocpro.eu',
      'nmd_02@verbadocpro.eu',
      'nmd_03@verbadocpro.eu',
      'nmd_04@verbadocpro.eu',
      'nmd_05@verbadocpro.eu'
    ];

    // Emails antiguos a eliminar (incluye los incorrectos @verbadoc.eu)
    const oldUsers = [
      'normadat_01@verbadocpro.eu',
      'normadat_02@verbadocpro.eu',
      'normadat_03@verbadocpro.eu',
      'normadat_04@verbadocpro.eu',
      'normadat_05@verbadocpro.eu',
      'nmd_01@verbadoc.eu',
      'nmd_02@verbadoc.eu',
      'nmd_03@verbadoc.eu',
      'nmd_04@verbadoc.eu',
      'nmd_05@verbadoc.eu'
    ];

    // 1. ELIMINAR USUARIOS ANTIGUOS
    console.log('━━━ ELIMINANDO USUARIOS ANTIGUOS ━━━\n');
    for (const email of oldUsers) {
      try {
        const result = await sql`
          DELETE FROM users WHERE email = ${email} RETURNING id, email
        `;
        if (result.rows.length > 0) {
          console.log(`🗑️  Eliminado: ${email} (ID: ${result.rows[0].id})`);
        } else {
          console.log(`⚪ No existía: ${email}`);
        }
      } catch (err) {
        console.log(`⚠️  Error eliminando ${email}: ${err.message}`);
      }
    }

    // 2. CREAR NUEVOS USUARIOS
    console.log('\n━━━ CREANDO NUEVOS USUARIOS ━━━\n');

    const tempPassword = 'Normadat2026!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Obtener client_id
    const demoUser = await sql`SELECT client_id FROM users WHERE email = 'demo@demo.eu' LIMIT 1`;
    const clientId = demoUser.rows[0]?.client_id || 1;

    for (const email of newUsers) {
      try {
        // Verificar si ya existe
        const existing = await sql`
          SELECT id FROM users WHERE email = ${email}
        `;

        if (existing.rows.length > 0) {
          console.log(`⚠️  Usuario ${email} ya existe (ID: ${existing.rows[0].id})`);
          continue;
        }

        // Crear usuario
        const result = await sql`
          INSERT INTO users (
            email,
            password,
            role,
            client_id,
            account_type,
            account_status,
            total_cost_usd,
            created_at,
            updated_at
          ) VALUES (
            ${email},
            ${hashedPassword},
            'reviewer',
            ${clientId},
            'production',
            'active',
            0.00,
            NOW(),
            NOW()
          )
          RETURNING id, email, role, account_status
        `;

        console.log(`✅ Creado: ${result.rows[0].email} (ID: ${result.rows[0].id})`);

      } catch (userError) {
        console.error(`❌ Error creando ${email}:`, userError.message);
      }
    }

    // 3. VERIFICAR TODOS LOS USUARIOS NMD
    console.log('\n━━━ VERIFICANDO USUARIOS NMD ━━━\n');
    const allUsers = await sql`
      SELECT id, email, role, account_status, created_at
      FROM users
      WHERE email LIKE '%nmd_%' OR email LIKE '%normadat%'
      ORDER BY email
    `;

    console.log(`📊 Total usuarios encontrados: ${allUsers.rows.length}\n`);
    allUsers.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email}`);
      console.log(`   ID: ${user.id} | Rol: ${user.role} | Estado: ${user.account_status}\n`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CREDENCIALES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    newUsers.forEach(email => console.log(`  ${email}`));
    console.log(`\n  Password: ${tempPassword}`);
    console.log('\n🎉 PROCESO COMPLETADO\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

createNormadatUsers();
