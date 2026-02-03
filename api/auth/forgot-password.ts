import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { UserDB } from '../lib/db.js';
import { Resend } from 'resend';

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
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email es requerido' });

    const user = await UserDB.findByEmail(email);
    
    // No revelar si el email existe
    if (!user) {
      return res.status(200).json({ success: true, message: 'Si el email existe, recibirás instrucciones.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ error: 'Error de configuración' });

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'password_reset' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const resetUrl = 'https://www.verbadocpro.eu/reset-password?token=' + resetToken;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return res.status(500).json({ error: 'Email no disponible' });

    const resend = new Resend(resendApiKey);
    const userName = user.name || '';
    
    await resend.emails.send({
      from: process.env.NOTIFICATION_EMAIL || 'VerbadocPro <onboarding@resend.dev>',
      to: email,
      subject: 'Restablecer contraseña - VerbadocPro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center;">
            <h1>Restablecer Contraseña</h1>
          </div>
          <div style="padding: 20px; background: #f8f9fa;">
            <p>Hola ${userName},</p>
            <p>Haz clic en el botón para restablecer tu contraseña:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
            </div>
            <p style="color: #666; font-size: 14px;">Este enlace expira en 1 hora.</p>
          </div>
        </div>
      `
    });

    return res.status(200).json({ success: true, message: 'Si el email existe, recibirás instrucciones.' });
  } catch (error: any) {
    console.error('Error forgot-password:', error);
    return res.status(500).json({ error: 'Error al procesar solicitud' });
  }
}
