import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { verifyAdmin } from '../lib/auth.js';
import { UserDB } from '../lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Verify that the user is an admin
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // GET - Listar todos los usuarios
    if (req.method === 'GET') {
      const users = await UserDB.getAll();
      const safeUsers = users.map(({ password, ...user }) => user);
      return res.status(200).json(safeUsers);
    }

    // POST - Crear nuevo usuario
    if (req.method === 'POST') {
      const { email, password, name, role } = req.body;

      // Validación
      if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }

      // Validar rol
      const validRoles = ['user', 'admin', 'reviewer'];
      const userRole = role && validRoles.includes(role) ? role : 'user';

      // Verificar si ya existe
      const existingUser = await UserDB.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'El usuario ya existe' });
      }

      // Hashear contraseña
      const hashedPassword = await bcrypt.hash(password, 12);

      // Crear usuario
      const user = await UserDB.create(email, hashedPassword, name || undefined, userRole);

      return res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          created_at: user.created_at,
        },
      });
    }

    // DELETE - Eliminar usuario
    if (req.method === 'DELETE') {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId es requerido' });
      }

      // Verificar que el usuario existe
      const userToDelete = await UserDB.findById(userId);
      if (!userToDelete) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Eliminar usuario
      const deleted = await UserDB.delete(userId);

      if (deleted) {
        return res.status(200).json({
          success: true,
          message: 'Usuario eliminado exitosamente',
        });
      } else {
        return res.status(500).json({ error: 'No se pudo eliminar el usuario' });
      }
    }

    // Método no permitido
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error: any) {
    console.error('Error en /api/admin/users:', error);

    if (error.message?.includes('unique constraint')) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
