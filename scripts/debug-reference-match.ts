import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@vercel/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env.local') });

async function debugReferenceMatch() {
  const expediente = 'B241889AC';
  
  console.log(`🔍 Buscando expediente: ${expediente}`);

  try {
    // 1. Buscar solo por expediente para ver si existe algo
    const simpleCheck = await sql`
      SELECT data 
      FROM reference_data 
      WHERE data->>'numero_expediente' = ${expediente}
    `;

    if (simpleCheck.rows.length === 0) {
      console.log('❌ No encontrado NINGÚN registro con ese expediente.');
      
      // Listar algunos expedientes disponibles para comparar
      const sample = await sql`SELECT data->>'numero_expediente' as exp FROM reference_data LIMIT 5`;
      console.log('Muestra de expedientes en BD:', sample.rows.map(r => r.exp));
      return;
    }

    console.log(`✅ Encontrados ${simpleCheck.rows.length} registros con ese expediente.`);
    console.log('Datos del primer registro encontrado:');
    const record = simpleCheck.rows[0].data;
    console.log(JSON.stringify(record, null, 2));

    // Valores extraídos del registro para probar el matching
    const dbAccion = record.d_cod_accion_formativa || record.id_accion_formativa;
    const dbGrupo = record.num_grupo || record.codigo_grupo_detalle;

    console.log('\n--- DATOS EN BD ---');
    console.log('Acción:', dbAccion);
    console.log('Grupo:', dbGrupo);

  } catch (error) {
    console.error('Error:', error);
  }
}

debugReferenceMatch();
