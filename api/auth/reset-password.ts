import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserDB } from '../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = [
    'https://www.verbadocpro.eu',
    'https://verbadoc-europa-pro.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ error: 'Error de configuración' });

    // Verificar token
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
      }
      return res.status(400).json({ error: 'Enlace inválido' });
    }

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Token inválido' });
    }

    // Buscar usuario
    const user = await UserDB.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar contraseña usando método update
    await UserDB.update(user.id, { password: hashedPassword });

    console.log('[Password Reset] Contraseña actualizada para:', user.email);

    return res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    console.error('Error reset-password:', error);
    return res.status(500).json({ error: 'Error al procesar solicitud' });
  }
}
