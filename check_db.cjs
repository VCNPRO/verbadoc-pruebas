require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function check() {
  try {
    // Verificar todas las tablas
    const tables = [
      'extraction_results',
      'unprocessable_documents',
      'master_excel_output',
      'transcriptions',
      'reference_data',
      'validation_errors',
      'access_logs'
    ];

    console.log('=== CONTEO DE REGISTROS POR TABLA ===\n');

    for (const table of tables) {
      try {
        const result = await sql.unsafe(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`${table}: ${result.rows[0].count} registros`);
      } catch (e) {
        console.log(`${table}: ERROR - ${e.message}`);
      }
    }

    // Verificar reference_data
    console.log('\n=== DATOS DE REFERENCIA ===');
    const refCount = await sql`SELECT COUNT(*) as count FROM reference_data`;
    console.log(`Total filas referencia: ${refCount.rows[0].count}`);

    // Verificar usuarios
    console.log('\n=== USUARIOS ===');
    const users = await sql`
      SELECT email, role, account_status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `;
    users.rows.forEach(u => {
      console.log(`${u.email} | ${u.role} | ${u.account_status}`);
    });

    // Access logs recientes
    console.log('\n=== ÚLTIMOS ACCESS LOGS ===');
    const logs = await sql`
      SELECT user_email, action, created_at
      FROM access_logs
      ORDER BY created_at DESC
      LIMIT 10
    `;
    if (logs.rows.length === 0) {
      console.log('No hay access logs');
    } else {
      logs.rows.forEach(l => {
        console.log(`${l.user_email} | ${l.action} | ${l.created_at}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

check();
