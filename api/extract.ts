import { VertexAI } from '@google-cloud/vertexai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Configuración de Vertex AI en región europea
const PROJECT_ID = process.env.VITE_GEMINI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = 'europe-west1'; // 🇪🇺 BÉLGICA - DATOS EN EUROPA

// Parsear credenciales desde variable de entorno
let credentials: any = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{')) {
      // Credenciales en formato JSON string (Vercel)
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } else {
      // Ruta a archivo de credenciales (desarrollo local)
      credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    console.log('🔑 Credenciales cargadas correctamente');
  } catch (error) {
    console.error('⚠️ Error al parsear credenciales:', error);
  }
}

// Inicializar Vertex AI con credenciales explícitas
const vertexAI = new VertexAI({
  project: PROJECT_ID!,
  location: LOCATION,
  googleAuthOptions: credentials ? {
    credentials: credentials
  } : undefined,
});

// Configuración para aceptar archivos grandes
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb' // Aumentar límite para PDFs grandes
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS restrictivo - Solo dominios autorizados
  const allowedOrigins = [
    'https://www.verbadocpro.eu',
    'https://verbadoc-europa-pro.vercel.app',
    'https://verbadoc-enterprise.vercel.app',
    // Permitir localhost solo en desarrollo
    ...(process.env.NODE_ENV === 'development' ? [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:4173'
    ] : [])
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model, contents, config } = req.body;

    // Validaciones mejoradas
    if (!model || !contents) {
      console.error('❌ Faltan campos requeridos:', { model: !!model, contents: !!contents });
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    // Verificar configuración
    if (!PROJECT_ID) {
      console.error('❌ VITE_GEMINI_PROJECT_ID o GOOGLE_CLOUD_PROJECT no están configurados');
      return res.status(500).json({
        error: 'Configuración incompleta',
        message: 'PROJECT_ID no está configurado. Verifica las variables de entorno VITE_GEMINI_PROJECT_ID o GOOGLE_CLOUD_PROJECT'
      });
    }

    if (!credentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('❌ GOOGLE_APPLICATION_CREDENTIALS no está configurado');
      return res.status(500).json({
        error: 'Configuración incompleta',
        message: 'Credenciales de Google Cloud no configuradas. Verifica la variable GOOGLE_APPLICATION_CREDENTIALS'
      });
    }

    console.log(`🇪🇺 Procesando con Vertex AI en ${LOCATION}`);
    console.log(`📍 Proyecto: ${PROJECT_ID}`);
    console.log(`🤖 Modelo: ${model}`);
    console.log(`📄 Tipo de contenido:`, contents.parts?.map((p: any) => p.text ? 'text' : p.inlineData ? `file(${p.inlineData.mimeType})` : 'unknown').join(', '));

    // Obtener el modelo generativo
    const generativeModel = vertexAI.getGenerativeModel({
      model: model,
      generationConfig: config?.generationConfig,
    });

    // Generar contenido con temperature=0 para máxima fiabilidad
    console.log(`⏳ Llamando a Vertex AI (temperature=0 para respuestas deterministas)...`);
    const result = await generativeModel.generateContent({
      contents: [contents],
      generationConfig: {
        temperature: 0, // 🎯 CRÍTICO: Respuestas deterministas para máxima fiabilidad
        topP: 1,        // Sin sampling aleatorio
        topK: 1,        // Seleccionar siempre el token más probable
        responseMimeType: config?.responseMimeType || 'application/json',
        responseSchema: config?.responseSchema,
        ...config?.generationConfig,
      },
    });

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`✅ Respuesta generada (${text.length} caracteres)`);

    return res.status(200).json({
      text: text,
      model: model,
      location: LOCATION,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Error en Vertex AI:', {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });

    // Determinar el tipo de error y dar respuestas más específicas
    let errorMessage = 'Error al procesar con Vertex AI';
    let userMessage = error.message || 'Error desconocido';

    if (error.code === 'ENOENT') {
      errorMessage = 'Archivo de credenciales no encontrado';
      userMessage = 'No se pudo leer el archivo de credenciales de Google Cloud';
    } else if (error.message?.includes('credentials') || error.message?.includes('authentication')) {
      errorMessage = 'Error de autenticación';
      userMessage = 'Las credenciales de Google Cloud son inválidas o han expirado';
    } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      errorMessage = 'Límite de uso excedido';
      userMessage = 'Se ha alcanzado el límite de solicitudes. Intenta más tarde';
    } else if (error.message?.includes('permission')) {
      errorMessage = 'Permisos insuficientes';
      userMessage = 'La cuenta de servicio no tiene permisos para Vertex AI';
    } else if (error.message?.includes('not found') || error.code === 404) {
      errorMessage = 'Modelo no encontrado';
      userMessage = `El modelo "${req.body.model}" no está disponible en ${LOCATION}`;
    }

    return res.status(500).json({
      error: errorMessage,
      message: userMessage,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.details : null,
    });
  }
}
