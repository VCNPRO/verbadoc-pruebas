/**
 * SyncStatus.tsx
 *
 * Componente que muestra el estado de sincronización BD → Local
 * y permite sincronizar manualmente.
 */

import React, { useState, useEffect } from 'react';
import { SyncService } from '../services/syncService';

interface SyncStatusProps {
  autoStart?: boolean; // Si debe iniciar auto-sync al montar
}

export default function SyncStatus({ autoStart = false }: SyncStatusProps) {
  const [status, setStatus] = useState(SyncService.getSyncStatus());
  const [lastResult, setLastResult] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Auto-iniciar sincronización si se solicita
    if (autoStart && !status.isAutoSyncActive) {
      SyncService.startAutoSync();
    }

    // Actualizar estado cada segundo
    const interval = setInterval(() => {
      setStatus(SyncService.getSyncStatus());
    }, 1000);

    return () => {
      clearInterval(interval);
      // Opcional: detener auto-sync al desmontar
      // SyncService.stopAutoSync();
    };
  }, [autoStart]);

  const handleManualSync = async () => {
    setSyncing(true);
    setLastResult('Sincronizando...');

    const result = await SyncService.syncNow();

    if (result.success) {
      if (result.rows === 0) {
        setLastResult('✅ Sin cambios desde última sincronización');
      } else {
        setLastResult(`✅ ${result.rows} filas sincronizadas - ${result.filename}`);
      }
    } else {
      setLastResult(`❌ Error: ${result.error}`);
    }

    setSyncing(false);

    // Limpiar mensaje después de 5 segundos
    setTimeout(() => setLastResult(''), 5000);
  };

  const handleToggleAutoSync = () => {
    if (status.isAutoSyncActive) {
      SyncService.stopAutoSync();
      setLastResult('⏹️  Sincronización automática detenida');
    } else {
      SyncService.startAutoSync();
      setLastResult('▶️  Sincronización automática iniciada');
    }

    setTimeout(() => setLastResult(''), 3000);
  };

  const formatLastSync = () => {
    if (!status.lastSyncTimestamp) {
      return 'Nunca';
    }

    const date = new Date(status.lastSyncTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Hace menos de 1 minuto';
    if (diffMins === 1) return 'Hace 1 minuto';
    if (diffMins < 60) return `Hace ${diffMins} minutos`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'Hace 1 hora';
    if (diffHours < 24) return `Hace ${diffHours} horas`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${status.isSyncing ? 'bg-yellow-500 animate-pulse' : status.isAutoSyncActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <h3 className="text-sm font-semibold text-gray-900">
            Sincronización BD → Local
          </h3>
        </div>

        <button
          onClick={handleToggleAutoSync}
          className={`text-xs px-3 py-1 rounded-full font-medium ${
            status.isAutoSyncActive
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {status.isAutoSyncActive ? '▶️ Auto ON' : '⏸️ Auto OFF'}
        </button>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Estado:</span>
          <span className="font-medium">
            {status.isSyncing ? '⏳ Sincronizando...' : '✓ Listo'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Última sincronización:</span>
          <span className="font-medium">{formatLastSync()}</span>
        </div>

        {status.isAutoSyncActive && (
          <div className="flex justify-between">
            <span>Próxima sincronización:</span>
            <span className="font-medium">{status.nextSyncIn}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleManualSync}
        disabled={syncing || status.isSyncing}
        className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {syncing || status.isSyncing ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            Sincronizando...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sincronizar Ahora
          </>
        )}
      </button>

      {lastResult && (
        <div className={`mt-3 p-2 rounded text-xs ${
          lastResult.startsWith('✅')
            ? 'bg-green-50 text-green-800 border border-green-200'
            : lastResult.startsWith('❌')
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {lastResult}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          💡 <strong>Tip:</strong> Activa la sincronización automática para mantener una copia local actualizada cada 5 minutos.
        </p>
      </div>
    </div>
  );
}
