/**
 * Verificar RLS en extraction_results
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkRLS() {
  try {
    // Ver RLS en extraction_results
    const rls = await sql`
      SELECT
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE tablename = 'extraction_results'
    `;

    console.log('RLS en extraction_results:');
    console.log(rls.rows[0]);
    console.log('');

    if (rls.rows[0]?.rowsecurity) {
      console.log('⚠️  RLS HABILITADO');
      console.log('Buscando políticas...\n');

      const policies = await sql`
        SELECT
          policyname,
          cmd,
          qual
        FROM pg_policies
        WHERE tablename = 'extraction_results'
      `;

      if (policies.rows.length > 0) {
        policies.rows.forEach(p => {
          console.log(`Policy: ${p.policyname}`);
          console.log(`  Command: ${p.cmd}`);
          console.log(`  Condition: ${p.qual}`);
          console.log('');
        });
      } else {
        console.log('No hay políticas definidas\n');
      }
    } else {
      console.log('✅ RLS DESHABILITADO\n');
    }

    // Intentar eliminar un registro específico
    console.log('Intentando eliminar DOC_002...\n');

    const doc002 = await sql`
      SELECT id, user_id, filename
      FROM extraction_results
      WHERE filename LIKE '%DOC_002%'
      LIMIT 1
    `;

    if (doc002.rows.length > 0) {
      const id = doc002.rows[0].id;
      const user_id = doc002.rows[0].user_id;

      console.log(`ID: ${id}`);
      console.log(`User ID: ${user_id}`);
      console.log(`Filename: ${doc002.rows[0].filename}\n`);

      console.log('SQL para eliminar:');
      console.log(`DELETE FROM extraction_results WHERE id = '${id}' AND user_id = '${user_id}';\n`);
    } else {
      console.log('DOC_002 no encontrado en extraction_results\n');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

checkRLS();
