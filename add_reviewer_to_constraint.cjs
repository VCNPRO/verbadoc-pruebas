require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function addReviewerRole() {
  try {
    console.log('\n🔧 MODIFICANDO CONSTRAINT users_role_check...\n');

    // Drop old constraint
    console.log('1. Eliminando constraint antigua...');
    await sql`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    `;
    console.log('✅ Constraint eliminada\n');

    // Add new constraint with reviewer
    console.log('2. Creando constraint nueva con reviewer...');
    await sql`
      ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'admin', 'reviewer'))
    `;
    console.log('✅ Constraint creada\n');

    // Verify
    console.log('━━━ VERIFICANDO ━━━');
    const constraint = await sql`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'users_role_check'
    `;

    console.log('Nueva definición:');
    console.log(constraint.rows[0].definition);
    console.log('\n🎉 ROL REVIEWER AÑADIDO CORRECTAMENTE\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

addReviewerRole();
