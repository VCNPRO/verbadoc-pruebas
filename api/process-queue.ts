import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processWithVertexAI } from './_lib/vertexService';

// Helper for concurrency (p-limit style)
async function asyncPool(poolLimit: number, array: any[], iteratorFn: any) {
  const ret = [];
  const executing: any[] = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.allSettled(ret);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar timeout de ejecución para Vercel Pro (300s configurado en vercel.json) 
  
  // Verificar auth del cron
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // Permitir ejecución si es local (development) o si tiene el secreto correcto
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== 'development') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Configuración de Batch
  // Reducimos el batch default a 20 para evitar timeouts en funciones de 60s/300s
  const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20'); 
  const CONCURRENCY_LIMIT = 5; // Procesar máximo 5 documentos en paralelo para no saturar Vertex API

  const processed: string[] = [];
  const failed: Array<{ documentId: string; error: string }> = [];

  try {
    console.log(`🔄 Iniciando procesamiento de cola (Batch: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY_LIMIT})...
`);

    // 1. Obtener batch de documentos de la cola
    const docs = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const docStr = await kv.lpop('documents_queue');
      if (!docStr) break; // Cola vacía
      
      try {
        docs.push(JSON.parse(docStr as string));
      } catch (e) {
        console.error('❌ Error parseando documento de la cola:', e);
      }
    }

    if (docs.length === 0) {
      console.log('📭 Cola vacía - sin documentos para procesar');
      return res.json({
        success: true,
        message: 'No documents in queue',
        processed: 0,
        failed: 0,
        remainingInQueue: 0
      });
    }

    console.log(`📝 Procesando ${docs.length} documentos...
`);

    // 2. Procesar documentos con límite de concurrencia
    await asyncPool(CONCURRENCY_LIMIT, docs, async (doc: any) => {
      const startTime = Date.now();
      const docId = doc.id || doc.documentId; // Compatibilidad

      try {
        console.log(`⏳ Procesando: ${docId} (${doc.fileName || 'Sin nombre'})
`);

        // Actualizar estado a "processing"
        await kv.set(`doc:${docId}:status`, 'processing');
        await kv.set(`doc:${docId}:startTime`, startTime);

        // Validar datos mínimos
        if (!doc.fileData) throw new Error('No fileData provided');
        if (!doc.schema) throw new Error('No schema provided');

        // Procesar directamente con la librería compartida (sin fetch)
        const textResult = await processWithVertexAI({
          model: doc.model || 'gemini-3-pro-preview',
          contents: {
            role: 'user',
            parts: [{
              inlineData: {
                data: doc.fileData, // Asumimos base64 limpio
                mimeType: 'application/pdf'
              }
            }]
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: doc.schema
          }
        });

        // Parsear resultado
        let jsonResult;
        try {
          // Intentar parsear JSON directo
          jsonResult = JSON.parse(textResult);
        } catch (e) {
          // Si falla, intentar limpiar markdown ```json ... ```
          console.warn(`⚠️ JSON malformado para ${docId}, intentando limpiar...
`);
          const cleanText = textResult.replace(/```json\n?|\n?```/g, '').trim();
          try {
            jsonResult = JSON.parse(cleanText);
          } catch (e2) {
             throw new Error('La respuesta de Vertex AI no es un JSON válido');
          }
        }

        const processingTime = Date.now() - startTime;

        // Guardar resultado exitoso
        await kv.set(`doc:${docId}:result`, JSON.stringify(jsonResult));
        await kv.set(`doc:${docId}:status`, 'completed');
        await kv.set(`doc:${docId}:completedTime`, Date.now());
        await kv.set(`doc:${docId}:processingTime`, processingTime);

        // Configurar expiración de 24 horas
        await kv.expire(`doc:${docId}:result`, 86400); 
        await kv.expire(`doc:${docId}:metadata`, 86400);

        processed.push(docId);
        console.log(`✅ Completado: ${docId} (${processingTime}ms)
`);

      } catch (error: any) {
        console.error(`❌ Falló ${docId}:`, error.message);

        // Guardar error
        await kv.set(`doc:${docId}:status`, 'error');
        await kv.set(`doc:${docId}:error`, error.message);
        await kv.set(`doc:${docId}:errorTime`, Date.now());

        failed.push({ documentId: docId, error: error.message });
      }
    });

    // 3. Resultados finales
    console.log(`📊 Resumen Batch: ${processed.length} procesados, ${failed.length} fallados
`);
    
    // Obtener tamaño restante de la cola
    const remainingInQueue = await kv.llen('documents_queue');

    return res.json({
      success: true,
      processed: processed.length,
      failed: failed.length,
      remainingInQueue,
      details: {
        processed,
        failed
      }
    });

  } catch (error: any) {
    console.error('❌ Error CRÍTICO en batch processing:', error);
    return res.status(500).json({
      error: 'Critical error processing queue',
      message: error.message,
      processed: processed.length,
      failed: failed.length
    });
  }
}