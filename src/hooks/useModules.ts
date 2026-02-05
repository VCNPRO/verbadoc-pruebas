/**
 * useModules.ts
 *
 * Hook to fetch and check user module permissions.
 */

import { useState, useEffect, useCallback } from 'react';

interface Module {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  active?: boolean;
  granted_at?: string;
  expires_at?: string | null;
  active_users?: number;
}

interface UseModulesReturn {
  modules: Module[];
  loading: boolean;
  error: string | null;
  hasModule: (moduleName: string) => boolean;
  refresh: () => void;
}

export function useModules(): UseModulesReturn {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/modules', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          setModules([]);
          return;
        }
        throw new Error('Error al cargar modulos');
      }

      const data = await response.json();
      setModules(data.modules || []);
    } catch (err: any) {
      console.error('Error loading modules:', err);
      setError(err.message);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const hasModule = useCallback((moduleName: string): boolean => {
    return modules.some(m => m.name === moduleName);
  }, [modules]);

  return {
    modules,
    loading,
    error,
    hasModule,
    refresh: fetchModules
  };
}
