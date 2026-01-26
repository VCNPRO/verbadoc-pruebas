// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { classifyDocument, recalibrateRegions, extractWithConfidence } from './_lib/idpService.js';
import { cropImage } from './_lib/imageUtils.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuración de CORS
  const allowedOrigins = ['https://www.verbadocpro.eu', 'https://verbadoc-europa-pro.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Aceptar múltiples formatos: base64Image, file, pdfBase64
    let base64Data = req.body.base64Image || req.body.file || req.body.pdfBase64 || req.body.base64;
    let mimeType = 'image/jpeg';

    if (!base64Data) {
      console.log("❌ Petición sin datos. Body recibido:", Object.keys(req.body || {}));
      return res.status(400).json({
        error: 'Falta el campo requerido: base64Image, file, pdfBase64 o base64',
        receivedFields: Object.keys(req.body || {}),
        hint: 'Envía el documento como base64 (imagen o PDF)'
      });
    }

    // Detectar si es PDF o imagen basándose en el contenido base64
    // PDF base64 empieza con "JVBERi" (que es "%PDF-" en base64)
    if (base64Data.startsWith('JVBERi') || base64Data.startsWith('data:application/pdf')) {
      mimeType = 'application/pdf';
      // Limpiar prefijo data URL si existe
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      console.log("📄 Detectado: PDF");
    } else {
      // Limpiar prefijo data URL si existe
      if (base64Data.includes(',')) {
        const parts = base64Data.split(',');
        if (parts[0].includes('image/png')) mimeType = 'image/png';
        else if (parts[0].includes('image/jpeg') || parts[0].includes('image/jpg')) mimeType = 'image/jpeg';
        base64Data = parts[1];
      }
      console.log("🖼️ Detectado: Imagen");
    }

    // Usar base64Data como la variable para el resto del flujo
    const base64Image = base64Data;

    console.log(`🚀 Iniciando flujo de extracción IDP... (${mimeType})`);

    // 1. Obtener todas las plantillas activas de la base de datos
    console.log("   - Capa 0: Obteniendo plantillas de la BD...");
    const templatesResult = await sql`
      SELECT id, name, regions FROM form_templates WHERE is_active = true;
    `;
    const templates = templatesResult.rows;
    if (templates.length === 0) {
      return res.status(500).json({ error: 'No hay plantillas de formulario activas en la base de datos.' });
    }
    console.log(`   ✅ Obtenidas ${templates.length} plantillas.`);

    // 2. Clasificar el documento para encontrar la mejor plantilla
    console.log("   - Capa 1: Clasificando documento...");
    const classification = await classifyDocument(base64Image, templates, mimeType);
    if (!classification || classification.confidence < 0.7) {
      console.log(`   ⚠️  Clasificación fallida o con baja confianza (${(classification?.confidence || 0) * 100}%)`);
      return res.status(422).json({
        error: 'Tipo de documento no reconocido',
        message: 'El documento no coincide con ninguna plantilla conocida con suficiente confianza.',
        status: 'needs_review'
      });
    }
    const matchedTemplate = templates.find(t => t.id === classification.id);
    console.log(`   ✅ Documento clasificado como "${matchedTemplate.name}" (Confianza: ${Math.round(classification.confidence * 100)}%)`);

    // 3. Recalibrar las coordenadas de la plantilla para este documento específico
    console.log("   - Capa 2: Recalibrando coordenadas...");
    const recalibratedRegions = await recalibrateRegions(base64Image, matchedTemplate.regions, mimeType);
    console.log("   ✅ Coordenadas recalibradas.");

    // 4. Extraer datos de cada región individualmente
    console.log("   - Capa 3: Extrayendo datos por región...");
    const extractedData = {};
    const extractionResults = [];

    for (const region of recalibratedRegions) {
      try {
        const regionImageBase64 = await cropImage(base64Image, region);
        const result = await extractWithConfidence(regionImageBase64, region);
        extractedData[region.label] = result.value;
        extractionResults.push({ label: region.label, value: result.value, success: true });
      } catch (regionError) {
        console.error(`      - ❌ Error extrayendo la región "${region.label}":`, regionError);
        extractedData[region.label] = 'ERROR_EXTRACCION';
        extractionResults.push({ label: region.label, value: 'ERROR', success: false });
      }
    }
    console.log("   ✅ Extracción por región completada.");

    // 5. Ensamblar y responder
    const finalConfidence = (extractionResults.filter(r => r.success).length / extractionResults.length);
    console.log(`   - Puntuación de confianza final: ${Math.round(finalConfidence * 100)}%`);

    return res.status(200).json({
      extractedData,
      confidence: finalConfidence,
      matchedTemplateId: matchedTemplate.id,
      status: finalConfidence > 0.85 ? 'valid' : 'needs_review',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Error fatal en el flujo de extracción IDP:', error);
    return res.status(500).json({
      error: 'Error en el servidor durante la extracción',
      message: error.message,
    });
  }
}
