import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface QueuedDocument {
  id: string;
  fileData: string; // Base64
  fileName: string;
  fileSize: number;
  schema: any;
  model: string;
  userId?: string;
  timestamp: number;
  status: 'queued' | 'processing' | 'completed' | 'error';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentId, fileData, fileName, fileSize, schema, model, userId } = req.body;

    // Validar datos requeridos
    if (!documentId || !fileData || !fileName || !schema) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['documentId', 'fileData', 'fileName', 'schema']
      });
    }

    // Crear item de cola
    const queueItem: QueuedDocument = {
      id: documentId,
      fileData,
      fileName,
      fileSize: fileSize || 0,
      schema,
      model: model || 'gemini-2.5-flash',
      userId,
      timestamp: Date.now(),
      status: 'queued'
    };

    // Encolar documento (añadir al final de la cola)
    await kv.rpush('documents_queue', JSON.stringify(queueItem));

    // Guardar estado inicial
    await kv.set(`doc:${documentId}:status`, 'queued');
    await kv.set(`doc:${documentId}:metadata`, JSON.stringify({
      fileName,
      fileSize,
      model,
      timestamp: queueItem.timestamp
    }));

    // Obtener posición en cola
    const queueLength = await kv.llen('documents_queue');

    console.log(`📋 Documento encolado: ${documentId} (${fileName}) - Posición: ${queueLength}`);

    return res.status(200).json({
      success: true,
      documentId,
      status: 'queued',
      message: 'Documento en cola de procesamiento',
      queuePosition: queueLength,
      estimatedWaitTime: Math.ceil(queueLength / 5) + ' minutos' // 5 docs por minuto
    });
  } catch (error: any) {
    console.error('❌ Error al encolar documento:', error);
    return res.status(500).json({
      error: 'Error al encolar documento',
      message: error.message
    });
  }
}
