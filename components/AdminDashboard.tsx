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

        // Filtrar por hoy
        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            result = result.filter(log => new Date(log.created_at) >= today);
        }

        // Filtrar por búsqueda
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

    // Verificar si el usuario actual es admin
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

    // Color del rol
    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin': return { bg: '#7c3aed', text: '#ffffff' };
            case 'reviewer': return { bg: '#f59e0b', text: '#ffffff' };
            default: return { bg: '#6b7280', text: '#ffffff' };
        }
    };

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: bgColor, color: textColor }}>
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
                            style={{
                                backgroundColor: '#10b981',
                                color: '#ffffff'
                            }}
                        >
                            Actualizar
                        </button>
                        <a
                            href="/"
                            className="px-4 py-2 rounded-lg transition-colors"
                            style={{
                                backgroundColor: cardBg,
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor
                            }}
                        >
                            ← Volver a la App
                        </a>
                        <button
                            onClick={logout}
                            className="px-4 py-2 rounded-lg transition-colors"
                            style={{
                                backgroundColor: '#dc2626',
                                color: '#ffffff'
                            }}
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Estadísticas */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Usuarios</p>
                                <p className="text-3xl font-bold mt-1">{loadingUsers ? '...' : stats.totalUsers}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Actividades</p>
                                <p className="text-3xl font-bold mt-1">{loadingLogs ? '...' : stats.totalLogs}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10b981' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Actividades Hoy</p>
                                <p className="text-3xl font-bold mt-1">{loadingLogs ? '...' : stats.todayLogs}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f59e0b' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Usuarios Activos Hoy</p>
                                <p className="text-3xl font-bold mt-1">{loadingLogs ? '...' : stats.todayUsers}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8b5cf6' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Usuarios Registrados */}
                <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Usuarios Registrados ({users.length})</h2>
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
                                return (
                                    <div
                                        key={u.id}
                                        className="p-3 rounded border"
                                        style={{ backgroundColor: bgColor, borderColor }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
                                                {(u.name || u.email).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm truncate">{u.name || 'Sin nombre'}</p>
                                                <p className="text-xs truncate" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                                    {u.email}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span
                                                        className="px-2 py-0.5 rounded text-xs font-medium"
                                                        style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
                                                    >
                                                        {u.role}
                                                    </span>
                                                    <span className="text-xs" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                                        {new Date(u.created_at).toLocaleDateString('es-ES')}
                                                    </span>
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
                        <div>
                            <label className="text-sm font-medium mr-2">Filtrar:</label>
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
                        </div>

                        {filter === 'user' && (
                            <div>
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    className="px-3 py-1.5 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                >
                                    <option value="">Seleccionar usuario</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Buscar en actividades..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-1.5 rounded border"
                                style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                            />
                        </div>
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

                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {loadingLogs ? (
                            <p className="text-center py-8" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                Cargando actividades...
                            </p>
                        ) : filteredLogs.length === 0 ? (
                            <p className="text-center py-8" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                No hay actividades registradas
                            </p>
                        ) : (
                            filteredLogs.map(log => (
                                <div
                                    key={log.id}
                                    className="p-3 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-sm">{log.user_email}</span>
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded"
                                                    style={{
                                                        backgroundColor: log.success ? '#10b981' : '#ef4444',
                                                        color: '#ffffff'
                                                    }}
                                                >
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                                {log.ip_address && `IP: ${log.ip_address} • `}
                                                {new Date(log.created_at).toLocaleString('es-ES')}
                                            </p>
                                        </div>
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
