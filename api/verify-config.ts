import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const PROJECT_ID = process.env.VITE_GEMINI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const GOOGLE_CREDS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    let credsStatus = 'No configuradas';
    let credsType = 'N/A';
    let projectIdFromCreds = 'N/A';
    let serviceAccount = 'N/A';
    let hasPrivateKey = false;

    if (GOOGLE_CREDS) {
      try {
        let credentials: any = null;

        if (GOOGLE_CREDS.startsWith('{')) {
          // JSON string
          credentials = JSON.parse(GOOGLE_CREDS);
          credsType = 'JSON inline';
        } else {
          // File path (shouldn't happen in Vercel)
          credsType = 'File path';
        }

        if (credentials) {
          credsStatus = 'Configuradas y parseadas correctamente';
          projectIdFromCreds = credentials.project_id || 'No encontrado';
          serviceAccount = credentials.client_email || 'No encontrado';
          hasPrivateKey = !!credentials.private_key;
        }
      } catch (error: any) {
        credsStatus = `Error al parsear: ${error.message}`;
      }
    }

    const response = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        VERCEL: process.env.VERCEL || 'false',
      },
      configuration: {
        PROJECT_ID: {
          configured: !!PROJECT_ID,
          value: PROJECT_ID || 'No configurado',
          source: process.env.VITE_GEMINI_PROJECT_ID ? 'VITE_GEMINI_PROJECT_ID' :
                  process.env.GOOGLE_CLOUD_PROJECT ? 'GOOGLE_CLOUD_PROJECT' : 'ninguna'
        },
        GOOGLE_APPLICATION_CREDENTIALS: {
          configured: !!GOOGLE_CREDS,
          status: credsStatus,
          type: credsType,
          projectIdFromCreds: projectIdFromCreds,
          serviceAccount: serviceAccount,
          hasPrivateKey: hasPrivateKey,
          projectIdMatch: PROJECT_ID === projectIdFromCreds,
        }
      },
      recommendations: []
    };

    // Añadir recomendaciones
    if (!PROJECT_ID) {
      response.recommendations.push('❌ Configura VITE_GEMINI_PROJECT_ID o GOOGLE_CLOUD_PROJECT en Vercel');
    }
    if (!GOOGLE_CREDS) {
      response.recommendations.push('❌ Configura GOOGLE_APPLICATION_CREDENTIALS en Vercel');
    }
    if (PROJECT_ID && projectIdFromCreds !== 'N/A' && PROJECT_ID !== projectIdFromCreds) {
      response.recommendations.push('⚠️ El PROJECT_ID configurado no coincide con el de las credenciales');
    }
    if (!hasPrivateKey && GOOGLE_CREDS) {
      response.recommendations.push('❌ Las credenciales no contienen private_key (JSON incompleto)');
    }
    if (serviceAccount === 'No encontrado' && GOOGLE_CREDS) {
      response.recommendations.push('❌ Las credenciales no contienen client_email (JSON incompleto)');
    }
    if (response.recommendations.length === 0) {
      response.recommendations.push('✅ La configuración parece correcta. Si sigue fallando, verifica los permisos de la service account en Google Cloud Console');
    }

    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Error al verificar configuración',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : null,
    });
  }
}
