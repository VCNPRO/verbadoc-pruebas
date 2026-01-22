import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 Test endpoint llamado');

  return res.status(200).json({
    success: true,
    message: 'Test endpoint funciona',
    timestamp: new Date().toISOString()
  });
}
