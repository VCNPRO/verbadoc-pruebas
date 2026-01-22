import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/lib/db';

export function AdminDashboard({ isLightMode }: { isLightMode: boolean }) {
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/admin/users');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetAdmin = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres hacer a este usuario administrador?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/set-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: 'admin' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set admin role');
      }

      fetchUsers();

    } catch (err: any) {
      setError(err.message);
      console.error('Failed to set admin role:', err);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Cargando panel de administración...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-900 text-red-500 flex items-center justify-center">Error: {error}</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>
      <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
        <table className="w-full min-w-max">
          <thead>
            <tr className="bg-gray-700 text-gray-300 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">Nombre</th>
              <th className="py-3 px-6 text-left">Email</th>
              <th className="py-3 px-6 text-center">Rol</th>
              <th className="py-3 px-6 text-center">Fecha de Registro</th>
              <th className="py-3 px-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-gray-200 text-sm font-light">
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-600">
                <td className="py-3 px-6 text-left whitespace-nowrap">
                  <span className="font-medium">{user.name || '-'}</span>
                </td>
                <td className="py-3 px-6 text-left">
                  <span>{user.email}</span>
                </td>
                <td className="py-3 px-6 text-center">
                  <span className={`py-1 px-3 rounded-full text-xs ${
                    user.role === 'admin'
                      ? 'bg-purple-200 text-purple-800'
                      : 'bg-green-200 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-6 text-center">
                  <span>{new Date(user.created_at).toLocaleDateString()}</span>
                </td>
                <td className="py-3 px-6 text-center">
                  {user.role !== 'admin' && (
                    <button
                      className="py-1 px-3 text-white bg-indigo-500 rounded-full text-xs hover:bg-indigo-600"
                      onClick={() => handleSetAdmin(user.id)}
                    >
                      Hacer Admin
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}