/**
 * UnprocessablePage.tsx
 *
 * Página para ver todos los documentos NO PROCESABLES
 * Ruta: /unprocessable
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import PinModal, { requiresPin } from './PinModal.tsx';

interface UnprocessableDocument {
  id: string;
  filename: string;
  rejection_category: string;
  rejection_reason: string;
  numero_expediente?: string;
  numero_accion?: string;
  numero_grupo?: string;
  extracted_data?: any;
  retry_count: number;
  max_retries: number;
  can_retry: boolean;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
}

interface Stats {
  rejection_category: string;
  count: number;
}

const CATEGORY_LABELS: Record<string, { text: string; color: string; icon: string }> = {
  sin_referencia: {
    text: 'Sin Referencia',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '🔍'
  },
  campos_faltantes: {
    text: 'Campos Faltantes',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '📝'
  },
  ilegible: {
    text: 'Ilegible',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: '👁️'
  },
  incompleto: {
    text: 'Incompleto',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '⚠️'
  },
  duplicado: {
    text: 'Duplicado',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '📋'
  },
  error_critico: {
    text: 'Error Crítico',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '❌'
  },
  formato_invalido: {
    text: 'Formato Inválido',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '📄'
  },
  manual_anulado: {
    text: 'Anulado Manualmente',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: '🗑️'
  }
};

export default function UnprocessablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UnprocessableDocument[]>([]);
  const [stats, setStats] = useState<Stats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<UnprocessableDocument | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // PIN Modal para eliminar
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    loadData();
  }, [categoryFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      setSelectedIds(new Set()); // Reset selection on reload

      const params = new URLSearchParams();
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/unprocessable?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar documentos no procesables');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
      setStats(data.stats || []);

      console.log('✅ Documentos no procesables cargados:', data.documents.length);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.size} documentos? Esta acción no se puede deshacer.`)) {
      return;
    }

    // Si el usuario requiere PIN, mostrar modal
    if (requiresPin(user?.email)) {
      setPendingDeleteAction(() => executeBulkDelete);
      setShowPinModal(true);
      return;
    }

    executeBulkDelete();
  };

  const executeBulkDelete = async () => {
    setProcessing(true);
    try {
      const promises = Array.from(selectedIds).map(async (id) => {
        const response = await fetch(`/api/unprocessable?id=${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        return response.ok;
      });

      await Promise.all(promises);

      alert('✅ Documentos seleccionados eliminados correctamente');
      loadData();
    } catch (error) {
      console.error('Error en eliminación masiva:', error);
      alert('Error al eliminar algunos documentos');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro de documentos no procesables?')) {
      return;
    }

    try {
      const response = await fetch(`/api/unprocessable?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al eliminar documento');
      }

      alert('✅ Documento eliminado correctamente');
      loadData(); // Recargar lista
    } catch (err: any) {
      console.error('Error al eliminar:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleViewDetails = (doc: UnprocessableDocument) => {
    setSelectedDoc(doc);
  };

  const handleSendToReview = async (id: string) => {
    if (!confirm('¿Enviar este documento a Revisión? Se moverá de No Procesables a la cola de revisión.')) {
      return;
    }

    try {
      const response = await fetch('/api/unprocessable', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ id, action: 'send_to_review' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar a revisión');
      }

      alert('Documento enviado a Revisión correctamente');
      loadData();
    } catch (err: any) {
      console.error('Error al enviar a revisión:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleBulkSendToReview = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Enviar ${selectedIds.size} documentos a Revisión? Se moverán de No Procesables a la cola de revisión.`)) {
      return;
    }

    setProcessing(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of Array.from(selectedIds)) {
        try {
          const response = await fetch('/api/unprocessable', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ id, action: 'send_to_review' })
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (errorCount > 0) {
        alert(`Enviados: ${successCount}, Errores: ${errorCount}`);
      } else {
        alert(`${successCount} documentos enviados a Revisión correctamente`);
      }
      loadData();
    } catch (error) {
      console.error('Error en envío masivo:', error);
      alert('Error al enviar documentos a revisión');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (selectedIds.size === 0) {
      alert('Por favor, selecciona al menos un documento.');
      return;
    }

    setProcessing(true);
    try {
      // Lazy load xlsx library
      const XLSX = await import('xlsx');

      const selectedDocs = documents.filter(doc => selectedIds.has(doc.id));

      const dataToExport = selectedDocs.map(doc => ({
        Archivo: doc.filename,
        Categoría: doc.rejection_category,
        Expediente: doc.numero_expediente || '-',
        Acción: doc.numero_accion || '-',
        Grupo: doc.numero_grupo || '-',
        Fecha: new Date(doc.created_at).toLocaleString('es-ES')
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'No Procesables');

      // Generate file and trigger download
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      XLSX.writeFile(workbook, `NoProcesables_${timestamp}.xlsx`);

      // Mark as downloaded and clear selection
      setDownloadedIds(prev => new Set([...prev, ...selectedIds]));
      setSelectedIds(new Set());

    } catch (error) {
      console.error('Error al generar el Excel:', error);
      alert('Hubo un error al generar el archivo Excel.');
    } finally {
      setProcessing(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const config = CATEGORY_LABELS[category] || CATEGORY_LABELS.error_critico;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${config.color}`}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </span>
    );
  };

  // El total debe ser la suma de los documentos filtrados, no el total histórico si los datos no coinciden
  const totalDocs = documents.length; 

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Documentos No Procesables
              </h1>
              <p className="text-gray-600 mt-1">
                Documentos rechazados automáticamente o anulados manualmente
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
                onClick={() => navigate('/master-excel')}
                className="px-4 py-2 text-emerald-600 hover:text-emerald-900 border border-emerald-200 rounded-lg hover:bg-emerald-50 font-medium"
              >
                📊 Excel Master
              </button>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-600 font-medium">Total No Procesables</div>
              <div className="text-2xl font-bold text-red-900 mt-1">{totalDocs}</div>
            </div>

            {stats.slice(0, 3).map(stat => {
              const config = CATEGORY_LABELS[stat.rejection_category] || CATEGORY_LABELS.error_critico;
              return (
                <div key={stat.rejection_category} className={`border rounded-lg p-4 ${config.color}`}>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span>{config.icon}</span>
                    <span>{config.text}</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{stat.count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex gap-4">
          {/* Filtro por categoría */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">Todas</option>
              {Object.entries(CATEGORY_LABELS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.text}
                </option>
              ))}
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
              placeholder="Nombre archivo, expediente..."
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
          
          {/* Barra de acciones en bloque */}
          {selectedIds.size > 0 && (
            <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex items-center justify-between">
              <div className="text-sm text-indigo-800 font-medium">
                {selectedIds.size} documentos seleccionados
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadExcel}
                  disabled={processing}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Descargar Excel
                </button>
                <button
                  onClick={handleBulkSendToReview}
                  disabled={processing}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {processing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  )}
                  Enviar a Revisión
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {processing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  Eliminar Seleccionados
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando documentos...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-600 text-lg">No hay documentos no procesables</p>
              <p className="text-gray-500 text-sm mt-2">
                Todos los documentos han sido procesados correctamente
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
                        checked={selectedIds.size === documents.length && documents.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Archivo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expediente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grupo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const isSelected = selectedIds.has(doc.id);
                    const isDownloaded = downloadedIds.has(doc.id);
                    return (
                      <tr key={doc.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(doc.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="max-w-xs truncate" title={doc.filename}>
                            {doc.filename}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getCategoryBadge(doc.rejection_category)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {doc.numero_expediente || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {doc.numero_accion || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {doc.numero_grupo || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(doc.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3 items-center">
                            {isDownloaded && (
                              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" title="Descargado en Excel"></div>
                            )}
                            <button
                              onClick={() => handleViewDetails(doc)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm"
                              title="Ver detalles"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => handleSendToReview(doc.id)}
                              className="text-green-600 hover:text-green-800 text-sm"
                              title="Enviar a Revisión"
                            >
                              📋
                            </button>
                          </div>
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

      {/* Modal de detalles */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Detalles del Documento</h2>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Archivo:</label>
                  <p className="text-gray-900">{selectedDoc.filename}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Categoría:</label>
                  <div className="mt-1">{getCategoryBadge(selectedDoc.rejection_category)}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Motivo del rechazo:</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded border border-gray-200 mt-1">
                    {selectedDoc.rejection_reason}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Expediente:</label>
                    <p className="text-gray-900">{selectedDoc.numero_expediente || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Acción:</label>
                    <p className="text-gray-900">{selectedDoc.numero_accion || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Grupo:</label>
                    <p className="text-gray-900">{selectedDoc.numero_grupo || 'N/A'}</p>
                  </div>
                </div>

                {selectedDoc.extracted_data && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Datos extraídos:</label>
                    <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded border border-gray-200 mt-1 overflow-auto max-h-60">
                      {JSON.stringify(selectedDoc.extracted_data, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  Fecha: {new Date(selectedDoc.created_at).toLocaleString()}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    handleSendToReview(selectedDoc.id);
                    setSelectedDoc(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Enviar a Revisión
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedDoc.id);
                    setSelectedDoc(null);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
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
        action="eliminar documentos"
      />
    </div>
  );
}
