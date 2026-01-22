/**
 * Limpieza automática de datos antiguos del localStorage
 */

const CLEANUP_VERSION_KEY = 'verbadoc_cleanup_version';
const CURRENT_CLEANUP_VERSION = '2';

export function cleanupOldLocalStorageData() {
    const lastCleanupVersion = localStorage.getItem(CLEANUP_VERSION_KEY);
    
    if (lastCleanupVersion !== CURRENT_CLEANUP_VERSION) {
        console.log('🧹 Limpiando datos antiguos...');
        
        // Limpiar usuario actual
        localStorage.removeItem('currentUserId');
        
        // Marcar limpieza como completada
        localStorage.setItem(CLEANUP_VERSION_KEY, CURRENT_CLEANUP_VERSION);
        
        // Forzar recarga
        window.location.reload();
    }
}
