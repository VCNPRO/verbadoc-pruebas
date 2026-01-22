/**
 * SERVICIO DE SINCRONIZACIÓN BD → LOCAL
 *
 * Mantiene una copia local del Excel Master sincronizada con la base de datos.
 * Se ejecuta automáticamente cada 5 minutos o manualmente.
 */

interface SyncResult {
  success: boolean;
  rows: number;
  timestamp: string;
  filename?: string;
  error?: string;
}

export class SyncService {
  private static lastSyncTimestamp: string | null = null;
  private static syncInterval: NodeJS.Timeout | null = null;
  private static isSyncing = false;

  /**
   * Iniciar sincronización automática cada 5 minutos
   */
  static startAutoSync() {
    if (this.syncInterval) {
      console.log('⚠️  Sincronización automática ya está activa');
      return;
    }

    console.log('🔄 Iniciando sincronización automática cada 5 minutos...');

    // Sincronizar inmediatamente
    this.syncNow();

    // Luego cada 5 minutos
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, 5 * 60 * 1000); // 5 minutos
  }

  /**
   * Detener sincronización automática
   */
  static stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️  Sincronización automática detenida');
    }
  }

  /**
   * Sincronizar ahora (manual o automática)
   */
  static async syncNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('⏳ Ya hay una sincronización en curso...');
      return {
        success: false,
        rows: 0,
        timestamp: new Date().toISOString(),
        error: 'Sincronización ya en curso'
      };
    }

    this.isSyncing = true;

    try {
      console.log('🔄 Iniciando sincronización con BD...');

      // Construir URL con timestamp del último sync (si existe)
      const params = new URLSearchParams();
      if (this.lastSyncTimestamp) {
        params.append('since', this.lastSyncTimestamp);
        console.log('📊 Sincronización incremental desde:', this.lastSyncTimestamp);
      } else {
        console.log('📊 Sincronización completa (primera vez)');
      }

      const response = await fetch(`/api/sync/download-master-excel?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      // Verificar si hay datos nuevos
      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        // No hay datos nuevos
        const data = await response.json();
        console.log('ℹ️ ', data.message);

        this.lastSyncTimestamp = data.lastSync;

        return {
          success: true,
          rows: 0,
          timestamp: data.lastSync,
          error: data.message
        };
      }

      // Obtener metadata del sync
      const rows = parseInt(response.headers.get('X-Sync-Rows') || '0');
      const timestamp = response.headers.get('X-Sync-Timestamp') || new Date().toISOString();

      // Descargar el Excel
      const blob = await response.blob();

      // Generar nombre de archivo
      const filename = `FUNDAE_Sync_${timestamp.replace(/[:.]/g, '-')}.xlsx`;

      // Guardar localmente (descarga automática)
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Actualizar timestamp del último sync
      this.lastSyncTimestamp = timestamp;

      // Guardar en localStorage para persistencia
      localStorage.setItem('last_sync_timestamp', timestamp);

      console.log(`✅ Sincronización completada: ${rows} filas descargadas`);

      return {
        success: true,
        rows,
        timestamp,
        filename
      };

    } catch (error: any) {
      console.error('❌ Error en sincronización:', error);
      return {
        success: false,
        rows: 0,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Obtener estado de la sincronización
   */
  static getSyncStatus() {
    return {
      isAutoSyncActive: this.syncInterval !== null,
      isSyncing: this.isSyncing,
      lastSyncTimestamp: this.lastSyncTimestamp || localStorage.getItem('last_sync_timestamp'),
      nextSyncIn: this.syncInterval ? '5 minutos' : 'No programada'
    };
  }

  /**
   * Restaurar último timestamp desde localStorage
   */
  static restoreLastSyncTimestamp() {
    const stored = localStorage.getItem('last_sync_timestamp');
    if (stored) {
      this.lastSyncTimestamp = stored;
      console.log('📦 Último sync restaurado:', stored);
    }
  }
}

// Auto-restaurar timestamp al importar
if (typeof window !== 'undefined') {
  SyncService.restoreLastSyncTimestamp();
}
