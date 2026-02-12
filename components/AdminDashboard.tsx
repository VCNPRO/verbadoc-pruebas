import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

// Tipos para datos de la BD
interface DBUser {
    id: string;
    email: string;
    name: string | null;
    role: 'user' | 'admin' | 'reviewer';
    client_id?: number;
    company_name?: string | null;
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

interface ExtractionStats {
    users: {
        total: number;
        byRole: Record<string, number>;
        newThisMonth: number;
    };
    extractions: {
        total: number;
        byStatus: Record<string, number>;
        recentErrors: number;
    };
    templates: {
        total: number;
    };
    dailyStats: Array<{
        date: string;
        extractions: number;
        active_users: number;
    }>;
    topCompanies: Array<{
        company_name: string;
        extraction_count: number;
        user_count: number;
    }>;
    recentExtractions: Array<{
        id: string;
        filename: string;
        status: string;
        created_at: string;
        email: string;
        name?: string;
        company_name?: string;
    }>;
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

    // Estado para estadísticas de extracciones
    const [extractionStats, setExtractionStats] = useState<ExtractionStats | null>(null);
    const [loadingExtractionStats, setLoadingExtractionStats] = useState(true);

    // Tab activa
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs' | 'extractions' | 'quotas' | 'consumos'>('overview');

    // Estado para consumos/usage
    const [usageData, setUsageData] = useState<any>(null);
    const [loadingUsage, setLoadingUsage] = useState(false);
    const [usagePeriod, setUsagePeriod] = useState<'week' | 'month' | 'quarter'>('month');
    const [usageCompanyFilter, setUsageCompanyFilter] = useState<string>('');

    // Estado para cuotas
    const [usersWithQuotas, setUsersWithQuotas] = useState<any[]>([]);
    const [loadingQuotas, setLoadingQuotas] = useState(false);
    const [editingQuota, setEditingQuota] = useState<string | null>(null);
    const [editQuotaValue, setEditQuotaValue] = useState<number>(10);

    // Filtros
    const [filter, setFilter] = useState<'all' | 'today' | 'user'>('all');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Estado para modal de crear usuario
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'user' as const });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Estado para modal de editar usuario
    const [showEditModal, setShowEditModal] = useState(false);
    const [editUser, setEditUser] = useState<{ userId: string; email: string; name: string; company_name: string; password: string }>({ userId: '', email: '', name: '', company_name: '', password: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

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

    // Cargar estadísticas de extracciones
    const loadExtractionStats = async () => {
        try {
            setLoadingExtractionStats(true);
            const response = await fetch('/api/admin/stats', {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Error al cargar estadísticas');
            }
            const data = await response.json();
            setExtractionStats(data);
        } catch (err: any) {
            console.error('Error loading extraction stats:', err);
        } finally {
            setLoadingExtractionStats(false);
        }
    };

    // Cargar usuarios con cuotas
    const loadUsersWithQuotas = async () => {
        try {
            setLoadingQuotas(true);
            const response = await fetch('/api/admin/user-quotas', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Error al cargar cuotas');
            const data = await response.json();
            setUsersWithQuotas(data.users || []);
        } catch (err: any) {
            console.error('Error loading quotas:', err);
        } finally {
            setLoadingQuotas(false);
        }
    };

    // Cargar datos de consumos
    const loadUsageData = async () => {
        try {
            setLoadingUsage(true);
            const params = new URLSearchParams({ period: usagePeriod });
            if (usageCompanyFilter) params.append('companyName', usageCompanyFilter);
            const response = await fetch(`/api/admin/usage-stats?${params.toString()}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Error al cargar consumos');
            const data = await response.json();
            setUsageData(data);
        } catch (err: any) {
            console.error('Error loading usage data:', err);
        } finally {
            setLoadingUsage(false);
        }
    };

    // Actualizar cuota de usuario
    const handleUpdateQuota = async (userId: string, quota: number) => {
        try {
            setActionLoading(userId);
            const response = await fetch('/api/admin/user-quotas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId, quota }),
            });
            if (!response.ok) throw new Error('Error al actualizar cuota');
            await loadUsersWithQuotas();
            setEditingQuota(null);
            alert('Cuota actualizada correctamente');
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Cambiar plan de usuario
    const handleChangePlan = async (userId: string, plan: string) => {
        try {
            setActionLoading(userId);
            const response = await fetch('/api/admin/user-quotas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId, plan }),
            });
            if (!response.ok) throw new Error('Error al cambiar plan');
            await loadUsersWithQuotas();
            alert('Plan actualizado correctamente');
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Resetear uso de usuario
    const handleResetUsage = async (userId: string) => {
        if (!confirm('¿Resetear el uso mensual de este usuario a 0?')) return;
        try {
            setActionLoading(userId);
            const response = await fetch('/api/admin/user-quotas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId, resetUsage: true }),
            });
            if (!response.ok) throw new Error('Error al resetear uso');
            await loadUsersWithQuotas();
            alert('Uso reseteado correctamente');
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(null);
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

    // Editar usuario
    const handleEditUser = async () => {
        try {
            setEditLoading(true);
            setEditError(null);

            const updates: any = { userId: editUser.userId };
            if (editUser.name !== undefined) updates.name = editUser.name;
            if (editUser.company_name !== undefined) updates.company_name = editUser.company_name;
            if (editUser.email) updates.email = editUser.email;
            if (editUser.password) updates.password = editUser.password;

            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al actualizar usuario');
            }

            await loadUsers();
            setShowEditModal(false);
        } catch (err: any) {
            setEditError(err.message);
        } finally {
            setEditLoading(false);
        }
    };

    // Abrir modal de edición con datos del usuario
    const openEditModal = (u: DBUser) => {
        setEditUser({
            userId: u.id,
            email: u.email,
            name: u.name || '',
            company_name: u.company_name || '',
            password: '',
        });
        setEditError(null);
        setShowEditModal(true);
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
        loadExtractionStats();
        loadUsersWithQuotas();
    }, []);

    // Recargar logs cuando cambian los filtros
    useEffect(() => {
        loadLogs();
    }, [filter, selectedUserId]);

    // Cargar usage data cuando se activa la tab o cambian filtros
    useEffect(() => {
        if (activeTab === 'consumos') {
            loadUsageData();
        }
    }, [activeTab, usagePeriod, usageCompanyFilter]);

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

            {/* Modal Editar Usuario */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="p-6 rounded-lg max-w-md w-full mx-4" style={{ backgroundColor: cardBg }}>
                        <h3 className="text-xl font-bold mb-4">Editar Usuario</h3>

                        {editError && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                                {editError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={editUser.name}
                                    onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    placeholder="Nombre del usuario"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Empresa</label>
                                <input
                                    type="text"
                                    value={editUser.company_name}
                                    onChange={(e) => setEditUser({ ...editUser, company_name: e.target.value })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    placeholder="Nombre de la empresa"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    value={editUser.email}
                                    onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    placeholder="usuario@ejemplo.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    value={editUser.password}
                                    onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                                    className="w-full px-3 py-2 rounded border"
                                    style={{ backgroundColor: bgColor, borderColor, color: textColor }}
                                    placeholder="Dejar vacío para no cambiar"
                                />
                                <p className="text-xs mt-1" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                    Solo rellenar si quieres cambiar la contraseña
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-4 py-2 rounded-lg border"
                                style={{ borderColor }}
                                disabled={editLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEditUser}
                                disabled={editLoading || !editUser.email}
                                className="flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                                style={{ backgroundColor: '#3b82f6' }}
                            >
                                {editLoading ? 'Guardando...' : 'Guardar Cambios'}
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
                            onClick={() => { loadUsers(); loadLogs(); loadExtractionStats(); loadUsersWithQuotas(); if (activeTab === 'consumos') loadUsageData(); }}
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

            {/* Tabs de navegación */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: cardBg }}>
                    {(['overview', 'users', 'quotas', 'logs', 'extractions', 'consumos'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="px-4 py-2 rounded-lg transition-colors font-medium"
                            style={{
                                backgroundColor: activeTab === tab ? accentColor : 'transparent',
                                color: activeTab === tab ? '#ffffff' : textColor,
                            }}
                        >
                            {tab === 'overview' && '📊 Resumen'}
                            {tab === 'users' && '👥 Usuarios'}
                            {tab === 'quotas' && '📦 Cuotas'}
                            {tab === 'logs' && '📋 Actividad'}
                            {tab === 'extractions' && '📄 Extracciones'}
                            {tab === 'consumos' && '💰 Consumos'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Tab Resumen - Estadísticas generales */}
                {activeTab === 'overview' && (
                <>
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

                {/* Estadísticas de Extracciones en Overview */}
                {extractionStats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                            <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Extracciones</p>
                            <p className="text-3xl font-bold mt-1">{extractionStats.extractions.total}</p>
                        </div>
                        <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                            <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Completadas</p>
                            <p className="text-3xl font-bold mt-1" style={{ color: '#10b981' }}>
                                {extractionStats.extractions.byStatus.completed || 0}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                            <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Plantillas</p>
                            <p className="text-3xl font-bold mt-1">{extractionStats.templates.total}</p>
                        </div>
                        <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor: extractionStats.extractions.recentErrors > 0 ? '#ef4444' : borderColor }}>
                            <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Errores (7 días)</p>
                            <p className="text-3xl font-bold mt-1" style={{ color: extractionStats.extractions.recentErrors > 0 ? '#ef4444' : '#10b981' }}>
                                {extractionStats.extractions.recentErrors}
                            </p>
                        </div>
                    </div>
                )}

                {/* Top Empresas */}
                {extractionStats && extractionStats.topCompanies.length > 0 && (
                    <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                        <h2 className="text-xl font-bold mb-4">Top Empresas por Extracciones</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        <th className="pb-2">Empresa</th>
                                        <th className="pb-2 text-center">Extracciones</th>
                                        <th className="pb-2 text-center">Usuarios</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {extractionStats.topCompanies.slice(0, 5).map((company, idx) => (
                                        <tr key={idx} className="border-t" style={{ borderColor }}>
                                            <td className="py-2">{company.company_name || 'Sin empresa'}</td>
                                            <td className="py-2 text-center font-bold">{company.extraction_count}</td>
                                            <td className="py-2 text-center">{company.user_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </>
                )}

                {/* Tab Usuarios */}
                {activeTab === 'users' && (
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

                                                    <button
                                                        onClick={() => openEditModal(u)}
                                                        disabled={isLoading}
                                                        className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                                                        title="Editar usuario"
                                                    >
                                                        Editar
                                                    </button>

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
                )}

                {/* Tab Cuotas */}
                {activeTab === 'quotas' && (
                <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Gestión de Cuotas y Planes</h2>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                                Free: 10 extracciones/mes
                            </span>
                            <span className="px-3 py-1 text-xs rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                Pro: 100 extracciones/mes
                            </span>
                            <span className="px-3 py-1 text-xs rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                                Enterprise: 1000 extracciones/mes
                            </span>
                        </div>
                    </div>

                    {loadingQuotas ? (
                        <div className="text-center py-8">
                            <p style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Cargando cuotas...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs uppercase" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        <th className="pb-3">Usuario</th>
                                        <th className="pb-3">Empresa</th>
                                        <th className="pb-3 text-center">Plan</th>
                                        <th className="pb-3 text-center">Uso / Cuota</th>
                                        <th className="pb-3 text-center">Reset</th>
                                        <th className="pb-3 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usersWithQuotas.map((u) => {
                                        const usage = u.monthly_usage_extractions || 0;
                                        const quota = u.monthly_quota_extractions || 10;
                                        const usagePercent = (usage / quota) * 100;
                                        const isOverQuota = usage >= quota;
                                        const isLoading = actionLoading === u.id;

                                        return (
                                            <tr key={u.id} className="border-t" style={{ borderColor, opacity: isLoading ? 0.5 : 1 }}>
                                                <td className="py-3">
                                                    <div>
                                                        <p className="font-medium">{u.name || u.email}</p>
                                                        <p className="text-xs" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>{u.email}</p>
                                                    </div>
                                                </td>
                                                <td className="py-3">{u.company_name || '-'}</td>
                                                <td className="py-3 text-center">
                                                    <select
                                                        value={u.subscription_plan || 'free'}
                                                        onChange={(e) => handleChangePlan(u.id, e.target.value)}
                                                        disabled={isLoading}
                                                        className="text-xs px-2 py-1 rounded border"
                                                        style={{
                                                            backgroundColor: u.subscription_plan === 'enterprise' ? '#7c3aed' : u.subscription_plan === 'pro' ? '#3b82f6' : '#6b7280',
                                                            color: '#fff',
                                                            borderColor: 'transparent'
                                                        }}
                                                    >
                                                        <option value="free">Free</option>
                                                        <option value="pro">Pro</option>
                                                        <option value="enterprise">Enterprise</option>
                                                    </select>
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        {editingQuota === u.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <span>{usage} / </span>
                                                                <input
                                                                    type="number"
                                                                    value={editQuotaValue}
                                                                    onChange={(e) => setEditQuotaValue(parseInt(e.target.value) || 0)}
                                                                    className="w-16 px-2 py-1 text-sm border rounded"
                                                                    style={{ backgroundColor: bgColor, borderColor }}
                                                                />
                                                                <button
                                                                    onClick={() => handleUpdateQuota(u.id, editQuotaValue)}
                                                                    className="px-2 py-1 bg-green-500 text-white text-xs rounded"
                                                                >
                                                                    ✓
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingQuota(null)}
                                                                    className="px-2 py-1 bg-gray-400 text-white text-xs rounded"
                                                                >
                                                                    ✗
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 px-2 py-1 rounded"
                                                                onClick={() => { setEditingQuota(u.id); setEditQuotaValue(quota); }}
                                                                title="Click para editar cuota"
                                                            >
                                                                <span className={isOverQuota ? 'text-red-600 font-bold' : ''}>
                                                                    {usage} / {quota}
                                                                </span>
                                                                <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                                                    <div
                                                                        className="h-2 rounded-full"
                                                                        style={{
                                                                            width: `${Math.min(usagePercent, 100)}%`,
                                                                            backgroundColor: isOverQuota ? '#ef4444' : usagePercent > 80 ? '#f59e0b' : '#10b981'
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-center text-xs" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                                    {u.quota_reset_date ? new Date(u.quota_reset_date).toLocaleDateString('es-ES') : '-'}
                                                </td>
                                                <td className="py-3 text-center">
                                                    <button
                                                        onClick={() => handleResetUsage(u.id)}
                                                        disabled={isLoading || usage === 0}
                                                        className="px-2 py-1 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                                                        title="Resetear uso a 0"
                                                    >
                                                        Reset
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                )}

                {/* Tab Logs */}
                {activeTab === 'logs' && (
                <>
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
                </>
                )}

                {/* Tab Extracciones */}
                {activeTab === 'extractions' && extractionStats && (
                <>
                {/* Estado de Extracciones */}
                <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <h2 className="text-xl font-bold mb-4">Estado de Extracciones</h2>
                    <div className="flex flex-wrap gap-4">
                        {Object.entries(extractionStats.extractions.byStatus).map(([status, count]) => {
                            const statusColors: Record<string, string> = {
                                completed: '#10b981',
                                processing: '#f59e0b',
                                error: '#ef4444',
                                pending: '#6b7280',
                            };
                            return (
                                <div key={status} className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: bgColor }}>
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[status] || '#6b7280' }}></span>
                                    <span className="capitalize">{status}</span>
                                    <span className="font-bold ml-2">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Extracciones Recientes */}
                <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <h2 className="text-xl font-bold mb-4">Extracciones Recientes</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                    <th className="pb-2">Archivo</th>
                                    <th className="pb-2">Usuario</th>
                                    <th className="pb-2">Empresa</th>
                                    <th className="pb-2 text-center">Estado</th>
                                    <th className="pb-2">Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {extractionStats.recentExtractions.map((ext) => {
                                    const statusColors: Record<string, { bg: string; text: string }> = {
                                        completed: { bg: '#d1fae5', text: '#065f46' },
                                        processing: { bg: '#fef3c7', text: '#92400e' },
                                        error: { bg: '#fee2e2', text: '#b91c1c' },
                                        pending: { bg: '#e5e7eb', text: '#374151' },
                                    };
                                    const colors = statusColors[ext.status] || statusColors.pending;
                                    return (
                                        <tr key={ext.id} className="border-t" style={{ borderColor }}>
                                            <td className="py-2 max-w-xs truncate">{ext.filename}</td>
                                            <td className="py-2">{ext.name || ext.email}</td>
                                            <td className="py-2">{ext.company_name || '-'}</td>
                                            <td className="py-2 text-center">
                                                <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: colors.bg, color: colors.text }}>
                                                    {ext.status}
                                                </span>
                                            </td>
                                            <td className="py-2 text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                                {new Date(ext.created_at).toLocaleString('es-ES')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actividad Diaria */}
                {extractionStats.dailyStats.length > 0 && (
                <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                    <h2 className="text-xl font-bold mb-4">Actividad Diaria (últimos 14 días)</h2>
                    <div className="flex items-end gap-2 h-40">
                        {extractionStats.dailyStats.slice(0, 14).reverse().map((day, idx) => {
                            const maxExtractions = Math.max(...extractionStats.dailyStats.map(d => Number(d.extractions)));
                            const height = maxExtractions > 0 ? (Number(day.extractions) / maxExtractions) * 100 : 5;
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center">
                                    <div
                                        className="w-full rounded-t"
                                        style={{
                                            height: `${Math.max(height, 5)}%`,
                                            backgroundColor: accentColor,
                                            minHeight: '4px',
                                        }}
                                        title={`${day.extractions} extracciones, ${day.active_users} usuarios activos`}
                                    />
                                    <span className="text-xs mt-1" style={{ color: isLightMode ? '#9ca3af' : '#64748b' }}>
                                        {new Date(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}
                </>
                )}

                {/* Loading state para extracciones */}
                {activeTab === 'extractions' && loadingExtractionStats && (
                    <div className="text-center py-8">
                        <p style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Cargando estadísticas...</p>
                    </div>
                )}

                {/* Tab Consumos */}
                {activeTab === 'consumos' && (
                <>
                    {/* Controles: Periodo + Filtro empresa */}
                    <div className="flex flex-wrap gap-4 mb-6 items-center">
                        <div className="flex gap-2">
                            {(['week', 'month', 'quarter'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setUsagePeriod(p)}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                    style={{
                                        backgroundColor: usagePeriod === p ? accentColor : cardBg,
                                        color: usagePeriod === p ? '#ffffff' : textColor,
                                        borderWidth: '1px', borderStyle: 'solid', borderColor,
                                    }}
                                >
                                    {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Trimestre'}
                                </button>
                            ))}
                        </div>
                        <select
                            value={usageCompanyFilter}
                            onChange={(e) => setUsageCompanyFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg text-sm"
                            style={{ backgroundColor: cardBg, color: textColor, borderWidth: '1px', borderStyle: 'solid', borderColor }}
                        >
                            <option value="">Todas las empresas</option>
                            {usageData?.availableCompanies?.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                if (!usageData) return;
                                const rows = [['Empresa', 'Tipo', 'Eventos', 'Tokens', 'Coste USD']];
                                for (const company of usageData.byCompany || []) {
                                    for (const [type, data] of Object.entries(company.breakdown || {})) {
                                        const d = data as any;
                                        rows.push([company.companyName, type, d.count, d.tokens, d.costUsd]);
                                    }
                                }
                                const csv = rows.map(r => r.join(',')).join('\n');
                                const blob = new Blob([csv], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `consumos_${usagePeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            style={{ backgroundColor: cardBg, color: textColor, borderWidth: '1px', borderStyle: 'solid', borderColor }}
                        >
                            Exportar CSV
                        </button>
                    </div>

                    {loadingUsage ? (
                        <div className="text-center py-8">
                            <p style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Cargando consumos...</p>
                        </div>
                    ) : usageData ? (
                    <>
                        {/* Tarjetas resumen */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Coste Total (USD)</p>
                                <p className="text-3xl font-bold mt-1" style={{ color: '#f59e0b' }}>
                                    ${usageData.summary.totalCostUsd.toFixed(4)}
                                </p>
                            </div>
                            <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Eventos</p>
                                <p className="text-3xl font-bold mt-1">{usageData.summary.totalEvents.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Total Tokens</p>
                                <p className="text-3xl font-bold mt-1">{usageData.summary.totalTokens.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-lg border" style={{ backgroundColor: cardBg, borderColor }}>
                                <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>Empresa Mayor Coste</p>
                                <p className="text-xl font-bold mt-1" style={{ color: accentColor }}>
                                    {usageData.byCompany?.[0]?.companyName || 'N/A'}
                                </p>
                                {usageData.byCompany?.[0] && (
                                    <p className="text-sm mt-1" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                        ${usageData.byCompany[0].totalCostUsd.toFixed(4)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Tabla por empresa */}
                        <div className="rounded-lg border overflow-hidden mb-6" style={{ borderColor }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr style={{ backgroundColor: cardBg }}>
                                            <th className="text-left p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px' }}>Empresa</th>
                                            <th className="text-right p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px' }}>Extracciones</th>
                                            <th className="text-right p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px' }}>RAG</th>
                                            <th className="text-right p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px' }}>Transcripciones</th>
                                            <th className="text-right p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px' }}>Emails</th>
                                            <th className="text-right p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px' }}>Storage</th>
                                            <th className="text-right p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px' }}>Tokens</th>
                                            <th className="text-right p-3 font-medium" style={{ borderColor, borderBottomWidth: '1px', color: '#f59e0b' }}>Coste Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(usageData.byCompany || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center p-6" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                                    Sin datos de consumo en este periodo
                                                </td>
                                            </tr>
                                        ) : (usageData.byCompany || []).map((company: any, idx: number) => (
                                            <tr key={idx} style={{ borderColor, borderTopWidth: idx > 0 ? '1px' : '0' }}>
                                                <td className="p-3 font-medium">{company.companyName}</td>
                                                <td className="text-right p-3">
                                                    {company.breakdown?.extraction?.count || 0}
                                                    {company.breakdown?.extraction?.costUsd > 0 && (
                                                        <span className="text-xs ml-1" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                                            (${company.breakdown.extraction.costUsd.toFixed(4)})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-right p-3">
                                                    {(company.breakdown?.rag_query?.count || 0) + (company.breakdown?.rag_ingest?.count || 0)}
                                                    {((company.breakdown?.rag_query?.costUsd || 0) + (company.breakdown?.rag_ingest?.costUsd || 0)) > 0 && (
                                                        <span className="text-xs ml-1" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                                            (${((company.breakdown?.rag_query?.costUsd || 0) + (company.breakdown?.rag_ingest?.costUsd || 0)).toFixed(4)})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-right p-3">
                                                    {company.breakdown?.transcription?.count || 0}
                                                </td>
                                                <td className="text-right p-3">
                                                    {company.breakdown?.email_send?.count || 0}
                                                </td>
                                                <td className="text-right p-3">
                                                    {company.breakdown?.blob_upload?.count || 0}
                                                </td>
                                                <td className="text-right p-3">{company.totalTokens.toLocaleString()}</td>
                                                <td className="text-right p-3 font-bold" style={{ color: '#f59e0b' }}>
                                                    ${company.totalCostUsd.toFixed(4)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Por modelo */}
                        {usageData.byModel && usageData.byModel.length > 0 && (
                        <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: cardBg, borderColor }}>
                            <h3 className="font-bold mb-3">Consumo por Modelo</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {usageData.byModel.map((m: any, idx: number) => (
                                    <div key={idx} className="p-3 rounded-lg border" style={{ borderColor }}>
                                        <p className="text-xs font-mono" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>{m.modelId}</p>
                                        <p className="text-lg font-bold mt-1">{m.events} eventos</p>
                                        <p className="text-sm" style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                            {m.tokens.toLocaleString()} tokens · ${m.costUsd.toFixed(4)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}

                        {/* Tendencia diaria */}
                        {usageData.dailyTrend && usageData.dailyTrend.length > 0 && (
                        <div className="rounded-lg border p-4" style={{ backgroundColor: cardBg, borderColor }}>
                            <h3 className="font-bold mb-3">Tendencia Diaria (Coste USD)</h3>
                            <div className="flex items-end gap-1" style={{ height: '120px' }}>
                                {(() => {
                                    const maxCost = Math.max(...usageData.dailyTrend.map((d: any) => d.costUsd), 0.0001);
                                    return usageData.dailyTrend.map((day: any, idx: number) => {
                                        const height = (day.costUsd / maxCost) * 100;
                                        return (
                                            <div key={idx} className="flex flex-col items-center flex-1" style={{ minWidth: '20px' }}>
                                                <div
                                                    className="w-full rounded-t"
                                                    style={{
                                                        height: `${Math.max(height, 3)}%`,
                                                        backgroundColor: accentColor,
                                                        minHeight: '3px',
                                                    }}
                                                    title={`${day.date}: $${day.costUsd.toFixed(4)} (${day.events} eventos, ${day.tokens.toLocaleString()} tokens)`}
                                                />
                                                <span className="text-xs mt-1" style={{ color: isLightMode ? '#9ca3af' : '#64748b', fontSize: '10px' }}>
                                                    {new Date(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                        )}
                    </>
                    ) : (
                        <div className="text-center py-8">
                            <p style={{ color: isLightMode ? '#6b7280' : '#94a3b8' }}>
                                No hay datos de consumos disponibles. Ejecuta primero la migración en /api/admin/run-migration-usage (POST).
                            </p>
                        </div>
                    )}
                </>
                )}
            </div>
        </div>
    );
};
