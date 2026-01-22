import { VertexAI } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.VITE_GEMINI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = 'europe-west1';

// Parsear credenciales (Singleton)
let credentials: any = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{')) {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } else {
      // Nota: require podría fallar en algunos bundlers de edge, pero en Node serverless ok
      credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    console.log('🔑 Credenciales Vertex AI cargadas');
  } catch (error) {
    console.error('⚠️ Error al parsear credenciales:', error);
  }
}

const vertexAI = new VertexAI({
  project: PROJECT_ID!,
  location: LOCATION,
  googleAuthOptions: credentials ? { credentials } : undefined,
});

export interface VertexExtractionOptions {
  model: string;
  contents: any; // ContentPart
  config?: {
    responseMimeType?: string;
    responseSchema?: any;
    generationConfig?: any;
  };
}

export async function processWithVertexAI({ model, contents, config }: VertexExtractionOptions): Promise<string> {
  if (!PROJECT_ID) {
    throw new Error('PROJECT_ID no está configurado. Verifica las variables de entorno.');
  }

  const generativeModel = vertexAI.getGenerativeModel({
    model: model,
    generationConfig: config?.generationConfig,
  });

  try {
    const result = await generativeModel.generateContent({
      contents: [contents],
      generationConfig: {
        responseMimeType: config?.responseMimeType || 'application/json',
        responseSchema: config?.responseSchema,
        ...config?.generationConfig,
      },
    });

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  } catch (error: any) {
    console.error('❌ Error en llamada a Vertex AI:', error.message);
    throw error;
  }
}
