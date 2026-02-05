/**
 * api/lib/modules.ts
 *
 * Middleware for module access verification
 */

import { sql } from '@vercel/postgres';

/**
 * Check if a user has access to a specific module.
 * Admin users always have access.
 */
export async function checkModuleAccess(userId: string, moduleName: string): Promise<boolean> {
  try {
    // Check if user is admin (always has access)
    const userResult = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (userResult.rows[0]?.role === 'admin') {
      return true;
    }

    // Check user_modules for active assignment
    const result = await sql`
      SELECT um.id
      FROM user_modules um
      JOIN service_modules sm ON um.module_id = sm.id
      WHERE um.user_id = ${userId}
        AND sm.name = ${moduleName}
        AND um.active = true
        AND sm.is_active = true
        AND (um.expires_at IS NULL OR um.expires_at > CURRENT_TIMESTAMP)
      LIMIT 1
    `;

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking module access:', error);
    return false;
  }
}

/**
 * Get all active module names for a user.
 * Admin users get all active modules.
 */
export async function getUserModules(userId: string): Promise<string[]> {
  try {
    // Check if user is admin
    const userResult = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (userResult.rows[0]?.role === 'admin') {
      const allModules = await sql`SELECT name FROM service_modules WHERE is_active = true`;
      return allModules.rows.map(m => m.name);
    }

    // Regular user: return assigned active modules
    const result = await sql`
      SELECT sm.name
      FROM user_modules um
      JOIN service_modules sm ON um.module_id = sm.id
      WHERE um.user_id = ${userId}
        AND um.active = true
        AND sm.is_active = true
        AND (um.expires_at IS NULL OR um.expires_at > CURRENT_TIMESTAMP)
    `;

    return result.rows.map(m => m.name);
  } catch (error) {
    console.error('Error getting user modules:', error);
    return [];
  }
}
