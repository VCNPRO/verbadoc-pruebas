/**
 * DEBUG: Verificar variables de entorno
 * ELIMINAR DESPUÉS DE DIAGNOSTICAR
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const envVars = {
    POSTGRES_URL: process.env.POSTGRES_URL ? '✅ SET (' + process.env.POSTGRES_URL.substring(0, 30) + '...)' : '❌ NOT SET',
    DATABASE_URL: process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET',
    JWT_SECRET: process.env.JWT_SECRET ? '✅ SET (' + process.env.JWT_SECRET.length + ' chars)' : '❌ NOT SET',
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ? '✅ SET' : '❌ NOT SET',
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? '✅ SET' : '❌ NOT SET',
  };

  // Intentar conexión a BD
  let dbStatus = '❌ NOT TESTED';
  try {
    const { sql } = await import('@vercel/postgres');
    const result = await sql`SELECT 1 as test`;
    dbStatus = result.rows.length > 0 ? '✅ CONNECTED' : '❌ NO ROWS';
  } catch (error: any) {
    dbStatus = `❌ ERROR: ${error.message}`;
  }

  return res.status(200).json({
    envVars,
    dbStatus,
    timestamp: new Date().toISOString()
  });
}
