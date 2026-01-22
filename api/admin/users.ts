import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdmin } from '../lib/auth.js';
import { UserDB } from '../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Verify that the user is an admin
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Fetch all users from the database
    const users = await UserDB.getAll();

    // Return the list of users (excluding password hashes)
    const safeUsers = users.map(({ password, ...user }) => user);

    return res.status(200).json(safeUsers);

  } catch (error: any) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}