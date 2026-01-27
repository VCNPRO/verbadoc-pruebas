import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { getActivityLogs, getActivityStats, getRecentActivityLogs, type ActivityLog } from '../src/utils/activityLogger';

interface AdminDashboardProps {
    isLightMode?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isLightMode = false }) => {
    const { user, logout } = useAuth();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [filter, setFilter] = useState<'all' | 'today' | 'user'>('all');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, [filter, selectedUserId]);

    const loadData = () => {
        const allLogs = getActivityLogs();
        const statistics = getActivityStats();

        let filteredLogs = allLogs;

        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            filteredLogs = allLogs.filter(log => log.timestamp >= today);
        } else if (filter === 'user' && selectedUserId) {
            filteredLogs = allLogs.filter(log => log.userId === selectedUserId);
        }

        setLogs(filteredLogs.reverse()); // Más recientes primero
        setStats(statistics);
    };

    // Obtener usuarios únicos de los logs
    const getUniqueUsers = () => {
        const users = new Map<string, { email: string; name: string; department?: string }>();
        getActivityLogs().forEach(log => {
            if (!users.has(log.userId)) {
                users.set(log.userId, {
                    email: log.userEmail,
                    name: log.userName,
                    department: log.department
                });
            }
        });
        return Array.from(users.entries()).map(([id, data]) => ({ id, ...data }));
    };

    const uniqueUsers = getUniqueUsers();

    // Filtrar logs por búsqueda
    const filteredBySearch = searchTerm
        ? logs.filter(log =>
            log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : logs;

    const bgColor = isLightMode ? '#ffffff' : '#0f172a';
    const textColor = isLightMode ? '#1f2937' : '#f1f5f9';
    const cardBg = isLightMode ? '#f9fafb' : '#1e293b';
    const borderColor = isLightMode ? '#e5e7eb' : '#334155';
    const accentColor = isLightMode ? '#2563eb' : '#06b6d4';

    // Verificar si el usuario actual es admin (por ahora, cualquiera puede acceder en modo mock)
    // En producción, verificarías roles/permisos reales
    const isAdmin = true;

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4" style={{ color: textColor }}>Acceso Denegado</h1>
                    <p style={{ color: textColor }}>No tienes permisos para acceder al panel de administración.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: bgColor, color: textColor }}>
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                            verbadoc pro europa • Sistema de Control
                        </p>
                    </div>
                    <div className="flex gap-3">
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
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Usuarios</p>
                                    <p className="text-3xl font-bold mt-1">{stats.totalUsers}</p>
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
                                    <p className="text-3xl font-bold mt-1">{stats.totalLogs}</p>
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
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Hoy</p>
                                    <p className="text-3xl font-bold mt-1">{stats.todayLogs}</p>
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
                                    <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Usuarios Hoy</p>
                                    <p className="text-3xl font-bold mt-1">{stats.todayUsers}</p>
                                </div>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8b5cf6' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Usuarios Registrados */}
                <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <h2 className="text-xl font-bold mb-4">Usuarios Registrados ({uniqueUsers.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {uniqueUsers.map(user => (
                            <div
                                key={user.id}
                                className="p-3 rounded border"
                                style={{ backgroundColor: bgColor, borderColor }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{user.name}</p>
                                        <p className="text-xs truncate" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                            {user.email}
                                        </p>
                                        {user.department && (
                                            <p className="text-xs mt-1">
                                                <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
                                                    {user.department}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Filtros */}
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
                                    {uniqueUsers.map(user => (
                                        <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
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
                    <h2 className="text-xl font-bold mb-4">Registro de Actividad ({filteredBySearch.length})</h2>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {filteredBySearch.length === 0 ? (
                            <p className="text-center py-8" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                No hay actividades registradas
                            </p>
                        ) : (
                            filteredBySearch.map(log => (
                                <div
                                    key={log.id}
                                    className="p-3 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-sm">{log.userName}</span>
                                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
                                                    {log.action}
                                                </span>
                                            </div>
                                            <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                                {log.details}
                                            </p>
                                            <p className="text-xs mt-1" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                                {log.userEmail} • {log.timestamp.toLocaleString('es-ES')}
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
