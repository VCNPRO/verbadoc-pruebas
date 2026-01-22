import { sql } from '@vercel/postgres';
import type { VercelRequest } from '@vercel/node';

export interface AccessLog {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  resource_name?: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export type AccessAction =
  // Auth actions
  | 'login'
  | 'logout'
  | 'login_failed'
  // View actions
  | 'view_review'
  | 'view_unprocessable'
  | 'view_master_excel'
  | 'view_admin_panel'
  // Data actions
  | 'download_excel'
  | 'download_pdf'
  | 'upload_reference'
  | 'upload_pdf'
  // Form actions
  | 'approve_form'
  | 'reject_form'
  | 'fix_error'
  | 'ignore_error'
  | 'validate_form'
  | 'cross_validate_form'
  // Admin actions
  | 'create_user'
  | 'update_user'
  | 'delete_user'
  | 'update_role'
  | 'update_column_mapping'
  | 'activate_column_mapping'
  // Other
  | 'export_consolidated'
  | 'send_to_review';

/**
 * Extract IP address from request
 * Handles proxies and load balancers (Vercel, Cloudflare, etc.)
 */
export function getClientIP(req: VercelRequest): string | null {
  // Try common proxy headers first
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, get the first one (client IP)
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Try other common headers
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  // Vercel-specific header
  const vercelForwardedFor = req.headers['x-vercel-forwarded-for'];
  if (vercelForwardedFor) {
    const ips = Array.isArray(vercelForwardedFor) ? vercelForwardedFor[0] : vercelForwardedFor;
    return ips.split(',')[0].trim();
  }

  // Fallback to connection remote address (may be proxy)
  return null; // VercelRequest doesn't expose socket info directly
}

/**
 * Get user agent from request
 */
export function getUserAgent(req: VercelRequest): string | null {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] : ua || null;
}

export const AccessLogDB = {
  /**
   * Log an access event
   */
  log: async (params: {
    userId: string;
    action: AccessAction;
    resourceType?: string;
    resourceId?: string;
    resourceName?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> => {
    try {
      const result = await sql`
        SELECT log_access(
          ${params.userId}::uuid,
          ${params.action},
          ${params.resourceType || null},
          ${params.resourceId || null},
          ${params.ipAddress || null},
          ${params.userAgent || null},
          ${params.success !== false}, -- default true
          ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb
        ) as log_id
      `;

      return result.rows[0]?.log_id || null;
    } catch (error) {
      console.error('[AccessLog] Error logging access:', error);
      // Don't throw - logging should never break the application
      return null;
    }
  },

  /**
   * Log access from a Vercel request (convenience method)
   */
  logFromRequest: async (params: {
    req: VercelRequest;
    userId: string;
    action: AccessAction;
    resourceType?: string;
    resourceId?: string;
    resourceName?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> => {
    return AccessLogDB.log({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      ipAddress: getClientIP(params.req) || undefined,
      userAgent: getUserAgent(params.req) || undefined,
      success: params.success,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    });
  },

  /**
   * Get logs for a specific user
   */
  findByUserId: async (userId: string, limit = 100): Promise<AccessLog[]> => {
    const result = await sql<AccessLog>`
      SELECT *
      FROM access_logs
      WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  /**
   * Get recent logs (admin only)
   */
  getRecent: async (limit = 100): Promise<AccessLog[]> => {
    const result = await sql<AccessLog>`
      SELECT *
      FROM access_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  /**
   * Get logs by action type
   */
  findByAction: async (action: AccessAction, limit = 100): Promise<AccessLog[]> => {
    const result = await sql<AccessLog>`
      SELECT *
      FROM access_logs
      WHERE action = ${action}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  /**
   * Get access logs for a specific resource
   */
  findByResource: async (resourceType: string, resourceId: string, limit = 50): Promise<AccessLog[]> => {
    const result = await sql<AccessLog>`
      SELECT *
      FROM access_logs
      WHERE resource_type = ${resourceType}
      AND resource_id = ${resourceId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  /**
   * Get access summary (for admin dashboard)
   */
  getSummary: async (days = 7): Promise<any[]> => {
    const result = await sql`
      SELECT
        DATE(created_at) as date,
        user_email,
        user_role,
        action,
        COUNT(*) as count,
        COUNT(DISTINCT resource_id) as unique_resources,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM access_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at), user_email, user_role, action
      ORDER BY date DESC, count DESC
    `;
    return result.rows;
  },
};
