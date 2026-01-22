/**
 * API: Crear Batch Job
 *
 * POST /api/batch/create
 *
 * Crea un nuevo batch para procesar múltiples PDFs
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import BatchProcessingService from '../../src/services/batchProcessingService.js';

// Helper: Verificar autenticación
function verifyAuth(req: VercelRequest): { userId: string; email: string; role: string } | null {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['auth-token'];
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticación
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const {
      name,
      description,
      modelUsed,
      promptTemplate,
      schemaConfig,
      files,
      priority
    } = req.body;

    // Validación
    if (!name || !files || !Array.isArray(files)) {
      return res.status(400).json({
        error: 'Faltan parámetros requeridos: name, files (array)'
      });
    }

    if (files.length === 0) {
      return res.status(400).json({
        error: 'El batch debe tener al menos un archivo'
      });
    }

    if (files.length > 500) {
      return res.status(400).json({
        error: 'El batch no puede tener más de 500 archivos'
      });
    }

    console.log(`📦 Creando batch: "${name}" con ${files.length} archivos`);

    // Crear batch
    const result = await BatchProcessingService.createBatch({
      userId: user.userId,
      name,
      description,
      modelUsed: modelUsed || 'gemini-2.5-flash',
      promptTemplate,
      schemaConfig,
      files,
      priority: priority || 0
    });

    console.log(`✅ Batch creado: ${result.batchId}`);

    return res.status(201).json({
      success: true,
      batchId: result.batchId,
      message: `Batch creado con ${files.length} archivos`
    });

  } catch (error: any) {
    console.error('❌ Error al crear batch:', error);

    return res.status(500).json({
      error: 'Error al crear batch',
      message: error.message
    });
  }
}
