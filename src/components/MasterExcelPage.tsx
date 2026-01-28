/**
 * MasterExcelPage.tsx
 *
 * Página para ver todos los formularios procesados y descargar el Excel master
 * Ruta: /master-excel
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import PinModal, { requiresPin } from './PinModal.tsx';

interface MasterExcelRow {
  id: string;
  extraction_id: string;
  row_data: any;
  row_number: number;
  filename: string;
  validation_status: string;
  cross_validation_match: boolean;
  discrepancy_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total_rows: number;
  pending: number;
  valid: number;
  needs_review: number;
  approved: number;
  rejected: number;
  with_discrepancies: number;
  fully_validated: number;
}

export default function MasterExcelPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<MasterExcelRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // PIN Modal para eliminar
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Ordenación
  const [sortField, setSortField] = useState<'filename' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Función para cambiar ordenación
  const handleSort = (field: 'filename' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filas ordenadas
  const sortedRows = [...rows].sort((a, b) => {
    const aValue = sortField === 'filename' ? a.filename.toLowerCase() : new Date(a.created_at).getTime();
    const bValue = sortField === 'filename' ? b.filename.toLowerCase() : new Date(b.created_at).getTime();
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const [viewingRow, setViewingRow] = useState<MasterExcelRow | null>(null);
  const [sendingToReview, setSendingToReview] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      setSelectedIds(new Set());

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/master-excel?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar formularios');
      }

      const data = await response.json();
      setRows(data.rows || []);
      setStats(data.stats);

      console.log('✅ Formularios cargados:', data.rows.length);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      setError('');

      const response = await fetch('/api/master-excel/download', {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al descargar Excel');
      }

      // Obtener el blob del Excel
      const blob = await response.blob();

      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FUNDAE_Master_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Excel descargado');
    } catch (err: any) {
      console.error('Error al descargar:', err);
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    if (!window.confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.size} registros?`)) {
      return;
    }

    // Si el usuario requiere PIN, mostrar modal
    if (requiresPin(user?.email)) {
      setPendingDeleteAction(() => executeDeleteSelected);
      setShowPinModal(true);
      return;
    }

    executeDeleteSelected();
  };

  const executeDeleteSelected = async () => {
    try {
      setDeleting(true);
      const response = await fetch('/api/master-excel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Error al eliminar registros');

      await loadData();
      alert('Registros eliminados correctamente');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = () => {
    if (!window.confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Esta acción eliminará TODOS los registros del Excel Master y no se puede deshacer.')) {
      return;
    }

    // Si el usuario requiere PIN, mostrar modal
    if (requiresPin(user?.email)) {
      setPendingDeleteAction(() => executeDeleteAll);
      setShowPinModal(true);
      return;
    }

    executeDeleteAll();
  };

  const executeDeleteAll = async () => {
    try {
      setDeleting(true);
      const response = await fetch('/api/master-excel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Error al eliminar todos los registros');

      await loadData();
      alert('Se han eliminado todos los registros correctamente');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Enviar seleccionados a Revisión
  const handleSendToReview = async () => {
    if (selectedIds.size === 0) return;

    if (!window.confirm(`¿Enviar ${selectedIds.size} registro(s) a Revisión? Desaparecerán del Excel Master hasta que los apruebes de nuevo.`)) {
      return;
    }

    try {
      setSendingToReview(true);
      setError('');

      const response = await fetch('/api/master-excel/send-to-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al enviar a revisión');
      }

      const result = await response.json();
      console.log('✅ Enviados a revisión:', result.count);

      // Recargar datos (los enviados desaparecerán)
      await loadData();

      alert(`${result.count} registro(s) enviado(s) a Revisión correctamente`);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setSendingToReview(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(r => r.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
      valid: { text: 'Válido', class: 'bg-green-100 text-green-800' },
      needs_review: { text: 'Requiere Revisión', class: 'bg-red-100 text-red-800' },
      approved: { text: 'Aprobado', class: 'bg-blue-100 text-blue-800' },
      rejected: { text: 'Rechazado', class: 'bg-gray-100 text-gray-800' }
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Excel Master FUNDAE
              </h1>
              <p className="text-gray-600 mt-1">
                Todos los formularios procesados listos para exportar
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Volver al inicio
              </button>
              <button
                onClick={() => navigate('/review')}
                className="px-4 py-2 text-orange-600 hover:text-orange-900 border border-orange-200 rounded-lg hover:bg-orange-50 font-medium"
              >
                📋 Revisar
              </button>
              <button
                onClick={() => navigate('/unprocessable')}
                className="px-4 py-2 text-red-600 hover:text-red-900 border border-red-200 rounded-lg hover:bg-red-50 font-medium"
              >
                ⚠️ No Procesables
              </button>
              {/* Solo test@test.eu puede eliminar todo */}
              {rows.length > 0 && user?.email === 'test@test.eu' && (
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  🗑️ Eliminar Todo
                </button>
              )}
              
              {/* Enviar a Revisión - visible para todos cuando hay selección */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleSendToReview}
                  disabled={sendingToReview}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-2"
                >
                  {sendingToReview ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      📝 Enviar a Revisión ({selectedIds.size})
                    </>
                  )}
                </button>
              )}

              {/* Solo test@test.eu puede eliminar seleccionados */}
              {selectedIds.size > 0 && user?.email === 'test@test.eu' && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-2"
                >
                  🗑️ Eliminar seleccionados ({selectedIds.size})
                </button>
              )}

              {/* Reviewers no pueden descargar Excel */}
              {user?.role !== 'reviewer' && (
                <button
                  onClick={handleDownloadExcel}
                  disabled={downloading || rows.length === 0}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                {downloading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Generando...
                  </>
                ) : (
                  <>
                    📥 Descargar Excel Master
                  </>
                )}
                </button>
              )}
            </div>
          </div>

          {/* Estadísticas */}
          {stats && (
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total Formularios</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{stats.total_rows - (stats.needs_review || 0)}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Validados</div>
                <div className="text-2xl font-bold text-green-900 mt-1">{stats.fully_validated}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Pendientes</div>
                <div className="text-2xl font-bold text-yellow-900 mt-1">{stats.pending}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Con Discrepancias</div>
                <div className="text-2xl font-bold text-red-900 mt-1">{stats.with_discrepancies}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex gap-4">
          {/* Filtro por estado */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="valid">Válidos</option>
              <option value="needs_review">Requiere Revisión</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
          </div>

          {/* Búsqueda */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadData()}
              placeholder="Expediente, CIF, empresa..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
            >
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando formularios...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600 text-lg">No hay formularios procesados</p>
              <p className="text-gray-500 text-sm mt-2">
                Los formularios que proceses aparecerán aquí automáticamente
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selectedIds.size === rows.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expediente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CIF</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('filename')}
                    >
                      Archivo {sortField === 'filename' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validación</th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('created_at')}
                    >
                      Fecha {sortField === 'created_at' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, idx) => {
                    const badge = getStatusBadge(row.validation_status);
                    const isSelected = selectedIds.has(row.id);
                    return (
                      <tr 
                        key={row.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(row.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.row_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {row.row_data?.numero_expediente || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.row_data?.nif_empresa || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.row_data?.razon_social?.substring(0, 30) || 'N/A'}
                          {row.row_data?.razon_social?.length > 30 && '...'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.filename.substring(0, 25)}
                          {row.filename.length > 25 && '...'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${badge.class}`}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.cross_validation_match ? (
                            <span className="text-green-600 text-sm">✓ Validado</span>
                          ) : row.discrepancy_count > 0 ? (
                            <span className="text-yellow-600 text-sm">{row.discrepancy_count} discrepancias</span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(row.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingRow(row)}
                            className="text-indigo-500 hover:text-indigo-700 p-1 rounded transition-colors"
                            title="Ver datos del formulario"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
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
      </div>

      {/* Modal Visor de Datos */}
      {viewingRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header del Modal */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Datos del Formulario
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {viewingRow.filename} - Expediente: {viewingRow.row_data?.numero_expediente || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setViewingRow(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido del Modal - Tabla de datos */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-1/3">Campo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {viewingRow.row_data && Object.entries(viewingRow.row_data)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <tr key={key} className="hover:bg-white transition-colors">
                          <td className="px-4 py-2 text-sm font-medium text-gray-700">
                            {key}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {value === null || value === undefined || value === 'null'
                              ? <span className="text-gray-400 italic">-</span>
                              : typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value)
                            }
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Metadatos */}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-blue-50 rounded-lg p-3">
                  <span className="text-blue-600 font-medium">Estado:</span>
                  <span className="ml-2 text-blue-900">{viewingRow.validation_status}</span>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <span className="text-green-600 font-medium">Validación cruzada:</span>
                  <span className="ml-2 text-green-900">
                    {viewingRow.cross_validation_match ? 'Coincide' : 'No coincide'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-600 font-medium">Versión:</span>
                  <span className="ml-2 text-gray-900">{viewingRow.version}</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-600 font-medium">Fecha:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(viewingRow.created_at).toLocaleString('es-ES')}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setViewingRow(null)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingDeleteAction(null);
        }}
        onSuccess={() => {
          if (pendingDeleteAction) {
            pendingDeleteAction();
          }
        }}
        action="eliminar registros"
      />
    </div>
  );
}
