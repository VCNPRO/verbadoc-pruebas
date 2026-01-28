import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyAdmin, verifyAuth } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  
  // GET - Cualquier usuario autenticado puede leer
  if (req.method === 'GET') {
    try {
      const user = await verifyAuth(req);
      if (!user) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      const result = await sql`
        SELECT value, updated_by, updated_at 
        FROM app_settings 
        WHERE key = 'total_counter'
      `;

      if (result.rows.length === 0) {
        return res.status(200).json({ value: 0, updated_by: null, updated_at: null });
      }

      const row = result.rows[0];
      return res.status(200).json({
        value: parseInt(row.value, 10),
        updated_by: row.updated_by,
        updated_at: row.updated_at
      });

    } catch (error: any) {
      console.error('Error getting total_counter:', error);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  // PUT - Solo admin puede modificar
  if (req.method === 'PUT') {
    try {
      const admin = await verifyAdmin(req);
      if (!admin) {
        return res.status(403).json({ error: 'Solo administradores pueden modificar este valor' });
      }

      const { value } = req.body;

      if (value === undefined || isNaN(parseInt(value, 10))) {
        return res.status(400).json({ error: 'Se requiere un valor numérico' });
      }

      const newValue = parseInt(value, 10);
      const valueStr = newValue.toString();

      await sql`
        INSERT INTO app_settings (key, value, updated_by, updated_at)
        VALUES ('total_counter', ${valueStr}, ${admin.email}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          value = ${valueStr},
          updated_by = ${admin.email},
          updated_at = CURRENT_TIMESTAMP
      `;

      return res.status(200).json({ 
        success: true, 
        value: newValue,
        updated_by: admin.email
      });

    } catch (error: any) {
      console.error('Error updating total_counter:', error);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
