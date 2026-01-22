require('dotenv').config({ path: '.env.local' });
const { kv } = require('@vercel/kv');

async function checkKV() {
  try {
    console.log('=== ESTADO DE VERCEL KV ===\n');

    // 1. Tamaño de la cola
    const queueLength = await kv.llen('documents_queue');
    console.log(`Cola de documentos: ${queueLength} documentos pendientes\n`);

    // 2. Ver primeros 5 documentos en cola
    if (queueLength > 0) {
      console.log('Primeros documentos en cola:');
      const docsInQueue = await kv.lrange('documents_queue', 0, 4);
      docsInQueue.forEach((doc, i) => {
        try {
          const parsed = typeof doc === 'string' ? JSON.parse(doc) : doc;
          console.log(`  ${i + 1}. ${parsed.fileName} (ID: ${parsed.id?.substring(0,8)}...)`);
        } catch (e) {
          console.log(`  ${i + 1}. [Error parseando]`);
        }
      });
      console.log('');
    }

    // 3. Buscar claves de documentos
    const keys = await kv.keys('doc:*:status');
    console.log(`Documentos con estado en KV: ${keys.length}`);

    if (keys.length > 0) {
      // Contar por estado
      let queued = 0, processing = 0, completed = 0, error = 0, other = 0;

      for (const key of keys.slice(0, 100)) {
        const status = await kv.get(key);
        if (status === 'queued') queued++;
        else if (status === 'processing') processing++;
        else if (status === 'completed') completed++;
        else if (status === 'error') error++;
        else other++;
      }

      console.log(`  - queued: ${queued}`);
      console.log(`  - processing: ${processing}`);
      console.log(`  - completed: ${completed}`);
      console.log(`  - error: ${error}`);
      if (other > 0) console.log(`  - other: ${other}`);
    }

    // 4. Buscar resultados
    const resultKeys = await kv.keys('doc:*:result');
    console.log(`\nResultados guardados en KV: ${resultKeys.length}`);

    // 5. Buscar errores recientes
    const errorKeys = await kv.keys('doc:*:error');
    console.log(`Errores guardados en KV: ${errorKeys.length}`);

    if (errorKeys.length > 0) {
      console.log('\nÚltimos errores:');
      for (let i = 0; i < Math.min(5, errorKeys.length); i++) {
        const key = errorKeys[i];
        const errorMsg = await kv.get(key);
        const docId = key.split(':')[1];
        console.log(`  ${docId.substring(0, 12)}...: ${errorMsg}`);
      }
    }

  } catch (error) {
    console.error('Error conectando a KV:', error.message);
  }

  process.exit(0);
}

checkKV();
