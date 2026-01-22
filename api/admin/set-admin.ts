import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdmin } from '../lib/auth.js';
import { UserDB } from '../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Verify that the user is an admin
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: 'userId y role son requeridos' });
    }
    
    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Update user role in the database
    const updatedUser = await UserDB.updateRole(userId, role);

    if (!updatedUser) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({ success: true, user: updatedUser });

  } catch (error: any) {
    console.error('Error setting user role:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
