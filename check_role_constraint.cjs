require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function checkRoleConstraint() {
  try {
    // Check the role constraint
    const constraint = await sql`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conname = 'users_role_check'
    `;

    console.log('\n📋 CONSTRAINT users_role_check:\n');
    if (constraint.rows.length > 0) {
      console.log(constraint.rows[0].constraint_definition);
    } else {
      console.log('⚠️ Constraint not found');
    }

    // Also check if there's an ENUM type
    console.log('\n📋 CHECKING ENUM TYPE user_role:\n');
    const enumType = await sql`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'user_role'
      )
      ORDER BY enumsortorder
    `;

    if (enumType.rows.length > 0) {
      console.log('Allowed values:');
      enumType.rows.forEach(row => {
        console.log(`  - ${row.enumlabel}`);
      });
    } else {
      console.log('⚠️ No ENUM type found');
    }

    // Check existing users to see what roles they have
    console.log('\n📋 EXISTING USER ROLES:\n');
    const roles = await sql`
      SELECT DISTINCT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `;

    roles.rows.forEach(row => {
      console.log(`  ${row.role}: ${row.count} usuarios`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkRoleConstraint();
