/**
 * DEBUG: Verificar variables de entorno
 * ELIMINAR DESPUÉS DE DIAGNOSTICAR
 */

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const envVars = {
    POSTGRES_URL: process.env.POSTGRES_URL ? 'SET (' + process.env.POSTGRES_URL.substring(0, 40) + '...)' : 'NOT SET',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    JWT_SECRET: process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : 'NOT SET',
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'NOT SET',
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'SET' : 'NOT SET',
  };

  return res.status(200).json({
    status: 'OK',
    envVars,
    timestamp: new Date().toISOString()
  });
}
