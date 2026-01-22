require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

async function createJaviUser() {
  try {
    console.log('\n👤 CREANDO USUARIO JAVI...\n');

    const email = 'nmd_000@verbadocpro.eu';
    const name = 'Javi';
    const tempPassword = 'Normadat2026!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Obtener client_id
    const demoUser = await sql`SELECT client_id FROM users WHERE email = 'demo@demo.eu' LIMIT 1`;
    const clientId = demoUser.rows[0]?.client_id || 1;

    // Verificar si ya existe
    const existing = await sql`
      SELECT id, role FROM users WHERE email = ${email}
    `;

    if (existing.rows.length > 0) {
      console.log(`⚠️  Usuario ${email} ya existe (ID: ${existing.rows[0].id}, Rol: ${existing.rows[0].role})`);
      console.log('Actualizando rol a "user" y añadiendo nombre...');

      await sql`
        UPDATE users
        SET role = 'user',
            name = ${name},
            updated_at = NOW()
        WHERE email = ${email}
      `;
      console.log(`✅ Usuario actualizado: ${email} -> rol: user, nombre: ${name}`);
    } else {
      // Crear usuario
      const result = await sql`
        INSERT INTO users (
          email,
          password,
          name,
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
          ${name},
          'user',
          ${clientId},
          'production',
          'active',
          0.00,
          NOW(),
          NOW()
        )
        RETURNING id, email, name, role, account_status
      `;

      console.log(`✅ Creado: ${result.rows[0].email}`);
      console.log(`   ID: ${result.rows[0].id}`);
      console.log(`   Nombre: ${result.rows[0].name}`);
      console.log(`   Rol: ${result.rows[0].role}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CREDENCIALES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Email: ${email}`);
    console.log(`  Nombre: ${name}`);
    console.log(`  Password: ${tempPassword}`);
    console.log(`  Rol: user`);
    console.log('\n🎉 COMPLETADO\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

createJaviUser();
