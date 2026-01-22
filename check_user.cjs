require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkUser() {
  try {
    // Buscar usuario por ID
    const userId = '8092d183-bec6-4a0c-bd39-a245f6305220';

    const result = await sql`
      SELECT id, email, name, role, account_status, created_at
      FROM users
      WHERE id = ${userId}::UUID
    `;

    if (result.rows.length === 0) {
      console.log(`Usuario ${userId} NO EXISTE en la BD`);
    } else {
      const user = result.rows[0];
      console.log('Usuario encontrado:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email || 'NULL'}`);
      console.log(`  Nombre: ${user.name || 'NULL'}`);
      console.log(`  Rol: ${user.role}`);
      console.log(`  Estado: ${user.account_status}`);
      console.log(`  Creado: ${user.created_at}`);
    }

    // Listar todos los usuarios
    console.log('\n=== TODOS LOS USUARIOS ===');
    const allUsers = await sql`
      SELECT id, email, role, account_status
      FROM users
      ORDER BY created_at DESC
    `;

    allUsers.rows.forEach((u, i) => {
      console.log(`${i+1}. ${u.email || 'NULL'} | ${u.role} | ${u.account_status} | ${u.id.substring(0,8)}...`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUser();
