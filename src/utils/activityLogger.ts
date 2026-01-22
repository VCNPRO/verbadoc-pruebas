// Sistema de logging de actividad para el admin

export interface ActivityLog {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    action: string;
    details: string;
    timestamp: Date;
    department?: string;
}

const STORAGE_KEY = 'verbadoc_europa_activity_logs';
const MAX_LOGS = 1000; // Límite de logs almacenados

// Obtener todos los logs
export function getActivityLogs(): ActivityLog[] {
    try {
        const logsJson = localStorage.getItem(STORAGE_KEY);
        if (!logsJson) return [];

        const logs = JSON.parse(logsJson);
        // Convertir timestamps de string a Date
        return logs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
        }));
    } catch (error) {
        console.error('Error loading activity logs:', error);
        return [];
    }
}

// Guardar logs
function saveActivityLogs(logs: ActivityLog[]) {
    try {
        // Mantener solo los últimos MAX_LOGS
        const logsToSave = logs.slice(-MAX_LOGS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logsToSave));
    } catch (error) {
        console.error('Error saving activity logs:', error);
    }
}

// Registrar una actividad
export function logActivity(
    userId: string,
    userEmail: string,
    userName: string,
    action: string,
    details: string,
    department?: string
) {
    const log: ActivityLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        userEmail,
        userName,
        action,
        details,
        timestamp: new Date(),
        department
    };

    const logs = getActivityLogs();
    logs.push(log);
    saveActivityLogs(logs);
}

// Obtener logs de un usuario específico
export function getUserActivityLogs(userId: string): ActivityLog[] {
    return getActivityLogs().filter(log => log.userId === userId);
}

// Obtener logs recientes (últimos N)
export function getRecentActivityLogs(limit: number = 50): ActivityLog[] {
    const logs = getActivityLogs();
    return logs.slice(-limit).reverse(); // Más recientes primero
}

// Limpiar logs antiguos (más de X días)
export function clearOldLogs(daysToKeep: number = 30) {
    const logs = getActivityLogs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filteredLogs = logs.filter(log => log.timestamp >= cutoffDate);
    saveActivityLogs(filteredLogs);
}

// Estadísticas de actividad
export function getActivityStats() {
    const logs = getActivityLogs();
    const users = new Set(logs.map(log => log.userId));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = logs.filter(log => log.timestamp >= today);
    const todayUsers = new Set(todayLogs.map(log => log.userId));

    // Contar acciones por tipo
    const actionCounts: Record<string, number> = {};
    logs.forEach(log => {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    return {
        totalLogs: logs.length,
        totalUsers: users.size,
        todayLogs: todayLogs.length,
        todayUsers: todayUsers.size,
        actionCounts,
        lastActivity: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    };
}
