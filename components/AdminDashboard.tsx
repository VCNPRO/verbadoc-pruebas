import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

// Tipos para datos de la BD
interface DBUser {
    id: string;
    email: string;
    name: string | null;
    role: 'user' | 'admin' | 'reviewer';
    client_id?: number;
    created_at: string;
    updated_at: string;
}

interface AccessLog {
    id: string;
    user_id: string;
    user_email: string;
    user_role: string;
    action: string;
    resource_type?: string;
    resource_id?: string;
    ip_address?: string;
    success: boolean;
    error_message?: string;
    created_at: string;
}

interface AdminDashboardProps {
    isLightMode?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
    login: 'Inicio sesión',
    logout: 'Cierre sesión',
    login_failed: 'Login fallido',
    view_review: 'Ver revisión',
    view_unprocessable: 'Ver no procesables',
    view_master_excel: 'Ver Excel Master',
    view_admin_panel: 'Ver admin',
    download_excel: 'Descarga Excel',
    download_pdf: 'Descarga PDF',
    upload_reference: 'Subir referencia',
    upload_pdf: 'Subir PDF',
    approve_form: 'Aprobar formulario',
    reject_form: 'Rechazar formulario',
    fix_error: 'Corregir error',
    create_user: 'Crear usuario',
    update_user: 'Editar usuario',
    delete_user: 'Eliminar usuario',
    update_role: 'Cambiar rol',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isLightMode = false }) => {
    const { user, logout } = useAuth();

    // Estado para usuarios de la BD
    const [users, setUsers] = useState<DBUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);

    // Estado para logs de la BD
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [logsError, setLogsError] = useState<string | null>(null);

    // Filtros
    const [filter, setFilter] = useState<'all' | 'today' | 'user'>('all');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Estado para modal de crear usuario
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'user' as const });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Estado para acciones en usuarios
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Cargar usuarios de la BD
    const loadUsers = async () => {
        try {
            setLoadingUsers(true);
            setUsersError(null);
            const response = await fetch('/api/admin/users', {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Error al cargar usuarios');
            }
            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setUsersError(err.message);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Cargar logs de la BD
    const loadLogs = async () => {
        try {
            setLoadingLogs(true);
            setLogsError(null);

            const params = new URLSearchParams();
            params.append('limit', '100');
            if (filter === 'user' && selectedUserId) {
                params.append('user_id', selectedUserId);
            }

            const response = await fetch(`/api/admin/logs?${params.toString()}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Error al cargar logs');
            }
            const data = await response.json();
            setLogs(data.logs || []);
        } catch (err: any) {
            setLogsError(err.message);
        } finally {
            setLoadingLogs(false);
        }
    };

    // Crear usuario
    const handleCreateUser = async () => {
        try {
            setCreateLoading(true);
            setCreateError(null);

            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newUser),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al crear usuario');
            }

            // Recargar usuarios y cerrar modal
            await loadUsers();
            setShowCreateModal(false);
            setNewUser({ email: '', password: '', name: '', role: 'user' });
        } catch (err: any) {
            setCreateError(err.message);
        } finally {
            setCreateLoading(false);
        }
    };

    // Eliminar usuario
    const handleDeleteUser = async (userId: string, userEmail: string) => {
        if (!confirm(`¿Estás seguro de eliminar al usuario ${userEmail}?`)) {
            return;
        }

        try {
            setActionLoading(userId);

            const response = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al eliminar usuario');
            }

            // Recargar usuarios
            await loadUsers();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Cambiar rol de usuario
    const handleChangeRole = async (userId: string, newRole: string) => {
        try {
            setActionLoading(userId);

            const response = await fetch('/api/admin/set-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId, role: newRole }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cambiar rol');
            }

            // Recargar usuarios
            await loadUsers();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // Cargar datos al montar
    useEffect(() => {
        loadUsers();
        loadLogs();
    }, []);

    // Recargar logs cuando cambian los filtros
    useEffect(() => {
        loadLogs();
    }, [filter, selectedUserId]);

    // Filtrar logs por búsqueda y fecha
    const filteredLogs = React.useMemo(() => {
        let result = logs;

        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            result = result.filter(log => new Date(log.created_at) >= today);
        }

        if (searchTerm) {
            result = result.filter(log =>
                log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.action.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return result;
    }, [logs, filter, searchTerm]);

    // Estadísticas calculadas
    const stats = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayLogs = logs.filter(log => new Date(log.created_at) >= today);
        const todayUserIds = new Set(todayLogs.map(log => log.user_id));

        return {
            totalUsers: users.length,
            totalLogs: logs.length,
            todayLogs: todayLogs.length,
            todayUsers: todayUserIds.size
        };
    }, [users, logs]);

    const bgColor = isLightMode ? '#ffffff' : '#0f172a';
    const textColor = isLightMode ? '#1f2937' : '#f1f5f9';
    const cardBg = isLightMode ? '#f9fafb' : '#1e293b';
    const borderColor = isLightMode ? '#e5e7eb' : '#334155';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';

    const isAdmin = user?.role === 'admin';

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4" style={{ color: textColor }}>Acceso Denegado</h1>
                    <p style={{ color: textColor }}>No tienes permisos para acceder al panel de administración.</p>
                    <a href="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Volver al inicio
                    </a>
                </div>
            </div>
        );
    }

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin': return { bg: '#7c3aed', text: '#ffffff' };
            case 'reviewer': return { bg: '#f59e0b', text: '#ffffff' };
            default: return { bg: '#6b7280', text: '#ffffff' };
        }
    };

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: bgColor, color: textColor }}>
            {/* Modal Crear Usuario */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="p-6 rounded-lg max-w-md w-full mx-4" style={{ backgroundColor: cardBg }}>
                        <h3 className="text-xl font-bold mb-4">Crear Nuevo Usuario</h3>

                        {createError && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                                {createError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    placeholder="usuario@ejemplo.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Contraseña *</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    placeholder="Nombre del usuario"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Rol</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                >
                                    <option value="user">Usuario</option>
                                    <option value="reviewer">Revisor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2 rounded-lg border"
                                style={{ borderColor }}
                                disabled={createLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateUser}
                                disabled={createLoading || !newUser.email || !newUser.password}
                                className="flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                                style={{ backgroundColor: '#10b981' }}
                            >
                                {createLoading ? 'Creando...' : 'Crear Usuario'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                            verbadoc pro europa - Gestión de Usuarios
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { loadUsers(); loadLogs(); }}
                            className="px-4 py-2 rounded-lg transition-colors"
                            style={{ backgroundColor: '#10b981', color: '#ffffff' }}
                        >
                            Actualizar
                        </button>
                        <a
                            href="/"
                            className="px-4 py-2 rounded-lg transition-colors"
                            style={{ backgroundColor: cardBg, borderWidth: '1px', borderStyle: 'solid', borderColor }}
                        >
                            ← Volver
                        </a>
                        <button
                            onClick={logout}
                            className="px-4 py-2 rounded-lg transition-colors"
                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Estadísticas */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Usuarios</p>
                        <p className="text-3xl font-bold mt-1">{loadingUsers ? '...' : stats.totalUsers}</p>
                    </div>
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Actividades</p>
                        <p className="text-3xl font-bold mt-1">{loadingLogs ? '...' : stats.totalLogs}</p>
                    </div>
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Actividades Hoy</p>
                        <p className="text-3xl font-bold mt-1">{loadingLogs ? '...' : stats.todayLogs}</p>
                    </div>
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Usuarios Activos Hoy</p>
                        <p className="text-3xl font-bold mt-1">{loadingLogs ? '...' : stats.todayUsers}</p>
                    </div>
                </div>

                {/* Usuarios Registrados */}
                <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Usuarios Registrados ({users.length})</h2>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 rounded-lg text-white font-medium"
                            style={{ backgroundColor: '#3b82f6' }}
                        >
                            + Añadir Usuario
                        </button>
                    </div>

                    {usersError && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                            Error: {usersError}
                        </div>
                    )}

                    {loadingUsers ? (
                        <div className="text-center py-8">
                            <p style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Cargando usuarios...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8">
                            <p style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>No hay usuarios registrados</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {users.map(u => {
                                const roleColor = getRoleColor(u.role);
                                const isCurrentUser = u.id === user?.id;
                                const isLoading = actionLoading === u.id;

                                return (
                                    <div
                                        key={u.id}
                                        className="p-4 rounded border"
                                        style={{ backgroundColor: bgColor, borderColor, opacity: isLoading ? 0.5 : 1 }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
                                                {(u.name || u.email).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm truncate">{u.name || 'Sin nombre'}</p>
                                                <p className="text-xs truncate" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                                    {u.email}
                                                </p>
                                                <p className="text-xs mt-1" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                                    Creado: {new Date(u.created_at).toLocaleDateString('es-ES')}
                                                </p>

                                                {/* Selector de rol */}
                                                <div className="mt-2 flex items-center gap-2">
                                                    <select
                                                        value={u.role}
                                                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                                        disabled={isLoading || isCurrentUser}
                                                        className="text-xs px-2 py-1 rounded border"
                                                        style={{
                                                            backgroundColor: roleColor.bg,
                                                            color: roleColor.text,
                                                            borderColor: roleColor.bg
                                                        }}
                                                    >
                                                        <option value="user">user</option>
                                                        <option value="reviewer">reviewer</option>
                                                        <option value="admin">admin</option>
                                                    </select>

                                                    {!isCurrentUser && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id, u.email)}
                                                            disabled={isLoading}
                                                            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                                                            title="Eliminar usuario"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    )}

                                                    {isCurrentUser && (
                                                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                                                            Tú
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Filtros de Logs */}
                <div className="mb-4 p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex flex-wrap gap-4 items-center">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="px-3 py-1.5 rounded border"
                            style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                        >
                            <option value="all">Todas las actividades</option>
                            <option value="today">Solo hoy</option>
                            <option value="user">Por usuario</option>
                        </select>

                        {filter === 'user' && (
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="px-3 py-1.5 rounded border"
                                style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                            >
                                <option value="">Seleccionar usuario</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                ))}
                            </select>
                        )}

                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded border"
                            style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                        />
                    </div>
                </div>

                {/* Logs de Actividad */}
                <div className="p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <h2 className="text-xl font-bold mb-4">Registro de Actividad ({filteredLogs.length})</h2>

                    {logsError && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                            Error: {logsError}
                        </div>
                    )}

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {loadingLogs ? (
                            <p className="text-center py-8" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                Cargando...
                            </p>
                        ) : filteredLogs.length === 0 ? (
                            <p className="text-center py-8" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                No hay actividades
                            </p>
                        ) : (
                            filteredLogs.map(log => (
                                <div key={log.id} className="p-3 rounded border" style={{ backgroundColor: bgColor, borderColor }}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{log.user_email}</span>
                                        <span
                                            className="text-xs px-2 py-0.5 rounded"
                                            style={{ backgroundColor: log.success ? '#10b981' : '#ef4444', color: '#fff' }}
                                        >
                                            {ACTION_LABELS[log.action] || log.action}
                                        </span>
                                        <span className="text-xs ml-auto" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                            {new Date(log.created_at).toLocaleString('es-ES')}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
