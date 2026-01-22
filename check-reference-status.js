// Script para verificar estado de referencia y documentos procesados
async function checkStatus() {
  console.log('==========================================');
  console.log('VERIFICACIÓN DE ESTADO DEL SISTEMA');
  console.log('==========================================\n');

  try {
    // 1. Verificar documentos no procesables
    console.log('1️⃣ DOCUMENTOS NO PROCESABLES:');
    const unprocessableRes = await fetch('/api/unprocessable', {
      credentials: 'include'
    });

    if (unprocessableRes.ok) {
      const unprocessableData = await unprocessableRes.json();
      const count = unprocessableData.documents ? unprocessableData.documents.length : 0;
      console.log(`   Total: ${count}`);

      if (count > 0) {
        const docs = unprocessableData.documents.slice(0, 5);
        docs.forEach((doc, i) => {
          console.log(`   ${i + 1}. ${doc.filename}`);
          console.log(`      Categoría: ${doc.category}`);
          console.log(`      Razón: ${doc.reason}`);
        });
      }
    } else {
      console.log(`   ❌ Error: ${unprocessableRes.status}`);
    }

    // 2. Verificar extracciones exitosas
    console.log('\n2️⃣ EXTRACCIONES EXITOSAS:');
    const extractionsRes = await fetch('/api/extractions?limit=10', {
      credentials: 'include'
    });

    if (extractionsRes.ok) {
      const extractionsData = await extractionsRes.json();
      const count = extractionsData.count || 0;
      console.log(`   Total: ${count}`);
      console.log(`   Stats:`, extractionsData.stats);

      if (extractionsData.extractions && extractionsData.extractions.length > 0) {
        console.log('\n   Últimas 5 extracciones:');
        const extractions = extractionsData.extractions.slice(0, 5);
        extractions.forEach((ext, i) => {
          const data = ext.extracted_data || {};
          console.log(`   ${i + 1}. ${ext.filename}`);
          console.log(`      Expediente: ${data.numero_expediente || data.expediente || 'N/A'}`);
          console.log(`      Acción: ${data.numero_accion || data.num_accion || 'N/A'}`);
          console.log(`      Grupo: ${data.numero_grupo || data.num_grupo || 'N/A'}`);
          console.log(`      Estado: ${ext.validation_status || 'pending'}`);
        });
      }
    } else {
      console.log(`   ❌ Error: ${extractionsRes.status}`);
    }

    // 3. Verificar los dos documentos recién procesados
    console.log('\n3️⃣ VERIFICANDO DOCUMENTOS RECIÉN PROCESADOS:');
    console.log('   Buscando: 1019_B241889AC y DOC_001...');

    const allExtractions = await fetch('/api/extractions?limit=50', {
      credentials: 'include'
    });

    if (allExtractions.ok) {
      const data = await allExtractions.json();
      const doc1 = data.extractions.find(e => e.filename.includes('1019_B241889AC'));
      const doc2 = data.extractions.find(e => e.filename.includes('DOC_001'));

      if (doc1) {
        console.log('\n   ✅ Encontrado: 1019_B241889AC');
        console.log(`      Status: ${doc1.validation_status}`);
        const d1 = doc1.extracted_data || {};
        console.log(`      Exp: ${d1.numero_expediente || d1.expediente}`);
        console.log(`      Acc: ${d1.numero_accion || d1.num_accion}`);
        console.log(`      Grp: ${d1.numero_grupo || d1.num_grupo}`);
      } else {
        console.log('\n   ❌ NO encontrado: 1019_B241889AC (podría estar en no procesables)');
      }

      if (doc2) {
        console.log('\n   ✅ Encontrado: DOC_001');
        console.log(`      Status: ${doc2.validation_status}`);
        const d2 = doc2.extracted_data || {};
        console.log(`      Exp: ${d2.numero_expediente || d2.expediente}`);
        console.log(`      Acc: ${d2.numero_accion || d2.num_accion}`);
        console.log(`      Grp: ${d2.numero_grupo || d2.num_grupo}`);
      } else {
        console.log('\n   ❌ NO encontrado: DOC_001 (podría estar en no procesables)');
      }
    }

    // 4. Información sobre reference_data
    console.log('\n4️⃣ DATOS DE REFERENCIA (reference_data):');
    console.log('   ⚠️  No hay endpoint API para consultar directamente');
    console.log('   💡 Para verificar el Excel SS339586_Final_v2, ejecuta en Neon Console:');
    console.log('\n   -------------------------------------------');
    console.log('   SELECT COUNT(*) as total,');
    console.log('          source_file,');
    console.log('          COUNT(CASE WHEN data ? \'D-EXPEDIENTE\' THEN 1 END) as con_d_expediente,');
    console.log('          COUNT(CASE WHEN data ? \'D_COD_ACCION\' THEN 1 END) as con_d_cod_accion,');
    console.log('          COUNT(CASE WHEN data ? \'D_COD_GRUPO\' THEN 1 END) as con_d_cod_grupo');
    console.log('   FROM reference_data');
    console.log('   WHERE is_active = true');
    console.log('   GROUP BY source_file;');
    console.log('   -------------------------------------------');
    console.log('\n   🔍 Buscar un registro específico:');
    console.log('   -------------------------------------------');
    console.log('   SELECT data FROM reference_data');
    console.log('   WHERE is_active = true');
    console.log('   LIMIT 1;');
    console.log('   -------------------------------------------');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }

  console.log('\n==========================================');
}

checkStatus();
