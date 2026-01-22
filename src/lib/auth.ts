import jwt from 'jsonwebtoken';
import { UserDB } from './db';

export interface JWTPayload {
  userId: string;
  email: string;
  role?: 'user' | 'admin';
  iat?: number;
  exp?: number;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth] JWT_SECRET no configurado');
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    // Solo loguear en desarrollo para evitar ruido en producción
    if (process.env.NODE_ENV === 'development') {
      console.error('[Auth] Error al verificar token:', error);
    }
    return null;
  }
}

export function getTokenFromRequest(request: Request | any): string | null {
  // SECURITY: Priorizar cookie httpOnly sobre Authorization header
  // Intentar obtener token desde cookie primero

  // Handle both standard Request and VercelRequest
  let cookieHeader: string | null = null;
  let authHeader: string | null = null;

  if ('headers' in request && typeof request.headers.get === 'function') {
    // Standard Request (Next.js)
    cookieHeader = request.headers.get('cookie');
    authHeader = request.headers.get('Authorization');
  } else if ('headers' in request && typeof request.headers === 'object') {
    // VercelRequest
    cookieHeader = request.headers['cookie'] || request.headers['Cookie'] || null;
    authHeader = request.headers['authorization'] || request.headers['Authorization'] || null;
  }

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth-token='));
    if (authCookie) {
      return authCookie.split('=')[1];
    }
  }

  // Fallback: Authorization header (para retrocompatibilidad)
  if (!authHeader) return null;

  // Support both "Bearer token" and just "token"
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token || null;
}

export function verifyRequestAuth(request: Request | any): JWTPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  return verifyToken(token);
}

// SECURITY: Verificar si el usuario autenticado es admin
export async function verifyAdmin(request: Request | any): Promise<boolean> {
  const auth = verifyRequestAuth(request);
  if (!auth) return false;

  // Verificar role en el token
  if (auth.role === 'admin') return true;

  // Si el token no tiene role, verificar en la base de datos
  try {
    const user = await UserDB.findById(auth.userId);
    return user?.role === 'admin';
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Auth] Error verificando admin:', error);
    }
    return false;
  }
}
