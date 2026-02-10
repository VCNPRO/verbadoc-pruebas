/**
 * ConfigModal.tsx
 * Modal de configuración con tema y logs de actividad
 *
 * Fecha: 15 Enero 2026
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useLanguage } from '../contexts/LanguageContext';
import { getLanguageByCode } from '../config/languages';
import * as XLSX from 'xlsx';
import { PIN_CONFIG, requiresPin } from './PinModal.tsx';

interface AccessLog {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  metadata?: any;
  created_at: string;
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  login: '🔑 Inicio sesión',
  logout: '🚪 Cierre sesión',
  login_failed: '❌ Login fallido',
  view_review: '👁️ Ver revisión',
  view_unprocessable: '👁️ Ver PDF',
  view_master_excel: '👁️ Ver Excel Master',
  view_admin_panel: '👁️ Ver admin',
  download_excel: '📥 Descarga Excel',
  download_pdf: '📥 Descarga PDF',
  upload_reference: '📤 Subir referencia',
  upload_pdf: '📤 Subir PDF',
  approve_form: '✅ Aprobar formulario',
  reject_form: '❌ Rechazar formulario',
  fix_error: '🔧 Corregir error',
  ignore_error: '🙈 Ignorar error',
  validate_form: '✔️ Validar formulario',
  cross_validate_form: '🔄 Validación cruzada',
  create_user: '👤 Crear usuario',
  update_user: '✏️ Editar usuario',
  delete_user: '🗑️ Eliminar usuario',
  update_role: '🎭 Cambiar rol',
  send_to_review: '📤 Enviar a revisión',
  export_consolidated: '📊 Exportar consolidado'
};

export default function ConfigModal({ isOpen, onClose, isDarkMode, onToggleDarkMode }: ConfigModalProps) {
  const { t } = useTranslation('config');
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'theme' | 'logs'>('theme');
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ action: '', user_email: '' });
  const [stats, setStats] = useState<{ action: string; count: number }[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isOpen && activeTab === 'logs' && isAdmin) {
      loadLogs();
    }
  }, [isOpen, activeTab, isAdmin]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('limit', '100');
      if (filter.action) params.append('action', filter.action);
      if (filter.user_email) params.append('user_email', filter.user_email);

      const response = await fetch(`/api/admin/logs?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats?.last24h || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportLogsToExcel = () => {
    if (logs.length === 0) return;

    const data = logs.map(log => ({
      'Fecha': new Date(log.created_at).toLocaleString(getLanguageByCode(currentLanguage).locale),
      'Usuario': log.user_email,
      'Rol': log.user_role,
      'Acción': ACTION_LABELS[log.action] || log.action,
      'IP': log.ip_address || '-',
      'Éxito': log.success ? 'Sí' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Logs');

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 18 }, // Fecha
      { wch: 25 }, // Usuario
      { wch: 10 }, // Rol
      { wch: 25 }, // Acción
      { wch: 15 }, // IP
      { wch: 6 }   // Éxito
    ];

    XLSX.writeFile(wb, `logs_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => setActiveTab('theme')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'theme'
                ? isDarkMode ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-blue-600 border-b-2 border-blue-600'
                : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tabs.general')}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'logs'
                  ? isDarkMode ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.logs')}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'theme' && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {t('appearance.theme')}
                </h3>
                <div className={`flex items-center justify-between p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{isDarkMode ? '🌙' : '☀️'}</span>
                    <div>
                      <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {isDarkMode ? t('appearance.darkMode') : t('appearance.lightMode')}
                      </p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Cambia la apariencia de la aplicación
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onToggleDarkMode}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      isDarkMode ? 'bg-cyan-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                        isDarkMode ? 'left-8' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Información
                </h3>
                <div className={`p-4 rounded-lg space-y-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <strong>Empresa:</strong> {user?.company_name || 'Normadat'}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <strong>Usuario:</strong> {user?.email || '-'}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <strong>Rol:</strong> {user?.role || '-'}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <strong>Versión:</strong> 1.0.0
                  </p>
                  {/* Mostrar PIN si el usuario lo requiere o es admin */}
                  {(requiresPin(user?.email) || isAdmin) && (
                    <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <strong>PIN de eliminación:</strong>{' '}
                        <span className="font-mono bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          {PIN_CONFIG.pin}
                        </span>
                      </p>
                      {isAdmin && (
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Aplica a: nmd_00 - nmd_05, nmd000 @verbadocpro.eu
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && isAdmin && (
            <div className="space-y-4">
              {/* Stats */}
              {stats.length > 0 && (
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                  <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-blue-800'}`}>
                    📊 Últimas 24 horas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {stats.slice(0, 6).map(stat => (
                      <span
                        key={stat.action}
                        className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-blue-100 text-blue-700'}`}
                      >
                        {ACTION_LABELS[stat.action] || stat.action}: {stat.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex gap-3 flex-wrap">
                <select
                  value={filter.action}
                  onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">{t('logs.action')}</option>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder={t('logs.user')}
                  value={filter.user_email}
                  onChange={(e) => setFilter({ ...filter, user_email: e.target.value })}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <button
                  onClick={loadLogs}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '⏳' : '🔍'} {t('logs.action')}
                </button>
                <button
                  onClick={exportLogsToExcel}
                  disabled={logs.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  📥 {t('logs.title')}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                  ❌ {error}
                </div>
              )}

              {/* Logs Table */}
              <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t('logs.date')}</th>
                        <th className={`px-4 py-3 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t('logs.user')}</th>
                        <th className={`px-4 py-3 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t('logs.action')}</th>
                        <th className={`px-4 py-3 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>IP</th>
                        <th className={`px-4 py-3 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t('logs.details')}</th>
                      </tr>
                    </thead>
                    <tbody className={isDarkMode ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className={`px-4 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('logs.noLogs')}
                          </td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={`px-4 py-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('logs.noLogs')}
                          </td>
                        </tr>
                      ) : (
                        logs.map(log => (
                          <tr key={log.id} className={isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                            <td className={`px-4 py-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                              {new Date(log.created_at).toLocaleString(getLanguageByCode(currentLanguage).locale, {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className={`px-4 py-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                              <span className="font-mono text-xs">{log.user_email}</span>
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                log.user_role === 'admin'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {log.user_role}
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                              {ACTION_LABELS[log.action] || log.action}
                            </td>
                            <td className={`px-4 py-3 font-mono text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {log.ip_address || '-'}
                            </td>
                            <td className="px-4 py-3">
                              {log.success ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-red-500" title={log.error_message}>✗</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Mostrando {logs.length} registros más recientes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
