import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from '../lib/db';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  console.log('🔐 AuthProvider montado - timestamp:', new Date().toISOString());

  // ⚠️ MODO BYPASS TEMPORAL - Quitar cuando se arregle la autenticación
  const BYPASS_AUTH = true;
  const mockUser: User = {
    id: '3360dfa5-mock-test',
    email: 'test@test.eu',
    name: 'Test User',
    role: 'admin',
    created_at: new Date(),
    updated_at: new Date(),
    password: ''
  };

  const [user, setUser] = useState<User | null>(BYPASS_AUTH ? mockUser : null);
  const [loading, setLoading] = useState(BYPASS_AUTH ? false : true);

  useEffect(() => {
    if (BYPASS_AUTH) {
      console.log('⚠️ MODO BYPASS AUTH ACTIVADO - Usuario simulado');
      return;
    }

    const verifyUser = async () => {
      try {
        const res = await fetch('/api/auth/verify');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
        console.error("Failed to verify user", error);
      } finally {
        setLoading(false);
      }
    };
    verifyUser();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        throw new Error(data.error || 'Failed to login');
      }
      return data;
    } finally {
      setLoading(false);
    }
  };
  
  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        throw new Error(data.error || 'Failed to register');
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log('🚪 Intentando hacer logout...');

    try {
      // Llamar a la API para limpiar la cookie httpOnly
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('❌ Error en logout API:', response.status, response.statusText);
      } else {
        console.log('✅ Logout API exitoso');
      }
    } catch (error) {
      console.error('❌ Error durante logout:', error);
    }

    // SIEMPRE limpiar el estado y redirigir, incluso si la API falla
    console.log('🔄 Limpiando estado y redirigiendo...');
    setUser(null);

    // Limpiar localStorage por si acaso
    localStorage.removeItem('user');

    // Forzar recarga completa de la página
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
