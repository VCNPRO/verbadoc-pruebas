import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentId } = req.query;

    if (!documentId || typeof documentId !== 'string') {
      return res.status(400).json({
        error: 'Missing documentId parameter',
        usage: '/api/document-status?documentId=xxx'
      });
    }

    // Obtener todos los datos del documento
    const [status, metadata, result, error, startTime, completedTime, processingTime] = await Promise.all([
      kv.get(`doc:${documentId}:status`),
      kv.get(`doc:${documentId}:metadata`),
      kv.get(`doc:${documentId}:result`),
      kv.get(`doc:${documentId}:error`),
      kv.get(`doc:${documentId}:startTime`),
      kv.get(`doc:${documentId}:completedTime`),
      kv.get(`doc:${documentId}:processingTime`)
    ]);

    if (!status) {
      return res.status(404).json({
        error: 'Document not found',
        documentId,
        message: 'El documento no existe o ya expiró (>24 horas)'
      });
    }

    // Parsear metadata y resultado
    let parsedMetadata = null;
    let parsedResult = null;

    try {
      if (metadata) parsedMetadata = JSON.parse(metadata as string);
      if (result) parsedResult = JSON.parse(result as string);
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }

    // Calcular tiempo estimado si está en cola
    let estimatedTimeRemaining = null;
    if (status === 'queued') {
      const queueLength = await kv.llen('documents_queue');
      estimatedTimeRemaining = Math.ceil(queueLength / 5) * 60; // segundos (5 docs/min)
    }

    // Calcular progreso si está procesando
    let progress = 0;
    if (status === 'processing') {
      const elapsed = Date.now() - (startTime as number || Date.now());
      const estimatedTotal = 60000; // 60 segundos estimado
      progress = Math.min(Math.round((elapsed / estimatedTotal) * 100), 99);
    } else if (status === 'completed') {
      progress = 100;
    }

    const response = {
      documentId,
      status,
      progress,
      metadata: parsedMetadata,
      result: parsedResult,
      error,
      timestamps: {
        queued: parsedMetadata?.timestamp,
        started: startTime,
        completed: completedTime,
        processingTime: processingTime ? `${processingTime}ms` : null
      },
      estimatedTimeRemaining: estimatedTimeRemaining ? `${estimatedTimeRemaining}s` : null
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('❌ Error al obtener estado:', error);
    return res.status(500).json({
      error: 'Error getting document status',
      message: error.message
    });
  }
}
