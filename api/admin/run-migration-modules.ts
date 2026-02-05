/**
 * run-migration-modules.ts
 *
 * Migration: Create service_modules and user_modules tables
 * POST /api/admin/run-migration-modules
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { verifyRequestAuth, verifyAdmin } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin access
    const auth = await verifyRequestAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const isAdmin = await verifyAdmin(auth);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Solo administradores' });
    }

    // Create service_modules table
    await sql`
      CREATE TABLE IF NOT EXISTS service_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        monthly_price DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create user_modules table
    await sql`
      CREATE TABLE IF NOT EXISTS user_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id UUID NOT NULL REFERENCES service_modules(id) ON DELETE CASCADE,
        active BOOLEAN DEFAULT true,
        granted_by UUID REFERENCES users(id),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, module_id)
      )
    `;

    // Insert default modules (upsert)
    const modules = [
      { name: 'extraction', description: 'Extraccion de datos de documentos', price: 29.00 },
      { name: 'rag', description: 'Busqueda semantica sobre documentos (RAG)', price: 19.00 },
      { name: 'review', description: 'Sistema de revision y validacion', price: 15.00 },
      { name: 'excel_master', description: 'Excel Master para exportacion', price: 15.00 },
      { name: 'batch', description: 'Procesamiento en lote de documentos', price: 25.00 },
      { name: 'templates', description: 'Plantillas personalizadas de extraccion', price: 10.00 }
    ];

    for (const mod of modules) {
      await sql`
        INSERT INTO service_modules (name, description, monthly_price)
        VALUES (${mod.name}, ${mod.description}, ${mod.price})
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          monthly_price = EXCLUDED.monthly_price,
          updated_at = CURRENT_TIMESTAMP
      `;
    }

    // Grant all modules to admin users
    const adminUsers = await sql`SELECT id FROM users WHERE role = 'admin'`;
    const allModules = await sql`SELECT id FROM service_modules WHERE is_active = true`;

    for (const adminUser of adminUsers.rows) {
      for (const mod of allModules.rows) {
        await sql`
          INSERT INTO user_modules (user_id, module_id, active, granted_by)
          VALUES (${adminUser.id}, ${mod.id}, true, ${auth.userId})
          ON CONFLICT (user_id, module_id) DO NOTHING
        `;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Migration completed: service_modules and user_modules tables created',
      modules_count: modules.length,
      admins_updated: adminUsers.rows.length
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
}
