// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeDocumentStructure } from '../_lib/idpService.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: 'Falta el campo requerido: base64Image' });
    }

    console.log("🤖 Solicitud para analizar estructura de documento...");
    const regions = await analyzeDocumentStructure(base64Image);
    console.log(`✅ Estructura analizada, se encontraron ${regions.length} regiones.`);

    return res.status(200).json({ regions });

  } catch (error: any) {
    console.error('❌ Error en /api/analyze-structure:', error);
    return res.status(500).json({
      error: 'Error al analizar la estructura del documento',
      message: error.message,
    });
  }
}
