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
  pdf_blob_url?: string;
  file_type?: string;
}

// Helper para detectar si es imagen
const isImageFile = (filename: string, fileType?: string): boolean => {
  if (fileType?.startsWith('image/')) return true;
  const ext = filename.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'webp', 'gif', 'bmp'].includes(ext || '');
};

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
  formulario_incompleto: {
    text: 'Formulario Incompleto',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: '📋'
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

export default function UnprocessablePage({ isDarkMode = false }: { isDarkMode?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UnprocessableDocument[]>([]);
  const [stats, setStats] = useState<Stats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  // Ordenación
  const [sortField, setSortField] = useState<'filename' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Theme variables for dark mode
  const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
  const bgSecondary = isDarkMode ? 'bg-[#1e293b]' : 'bg-[#e8edf2]';
  const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
  const border = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';
  const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const hoverRow = isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]';
  const bgInput = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white border-gray-300';

  // Función para cambiar ordenación
  const handleSort = (field: 'filename' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Documentos ordenados
  const sortedDocuments = [...documents].sort((a, b) => {
    const aValue = sortField === 'filename' ? a.filename.toLowerCase() : new Date(a.created_at).getTime();
    const bValue = sortField === 'filename' ? b.filename.toLowerCase() : new Date(b.created_at).getTime();
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const [selectedDoc, setSelectedDoc] = useState<UnprocessableDocument | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // PIN Modal para eliminar
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);

  // Cargar PDF como blob local para evitar bloqueo de iframe por CSP/X-Frame-Options
  useEffect(() => {
    if (!selectedDoc?.pdf_blob_url) {
      setPdfBlobUrl(null);
      return;
    }
    let revoked = false;
    fetch(selectedDoc.pdf_blob_url)
      .then(res => res.blob())
      .then(blob => {
        if (!revoked) {
          setPdfBlobUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => setPdfBlobUrl(null));
    return () => {
      revoked = true;
    };
  }, [selectedDoc]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      setSelectedIds(new Set()); // Reset selection on reload

      const params = new URLSearchParams();
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

  // Total real = suma de todas las categorías (stats viene sin límite del servidor)
  const totalDocs = stats.length > 0
    ? stats.reduce((sum, s) => sum + parseInt(String(s.count)), 0)
    : documents.length;

  return (
    <div className={`min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className={`${bgCard} border-b ${border}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>
                Documentos PDF
              </h1>
              <p className={`${textSecondary} mt-1`}>
                Documentos PDF del cliente
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className={`px-4 py-2 ${textSecondary} hover:${textPrimary} border ${border} rounded-lg ${hoverRow}`}
              >
                ← Volver al inicio
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
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className={`${bgCard} border ${border} rounded-lg p-4 flex gap-4`}>
          <div className="flex-1">
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
              Buscar
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadData()}
              placeholder="Buscar..."
              className={`w-full px-3 py-2 rounded-md ${bgInput}`}
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
        <div className={`${bgCard} border ${border} rounded-lg overflow-hidden`}>
          
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
              <p className={`${textSecondary}`}>Cargando documentos...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">✅</div>
              <p className={`${textSecondary} text-lg`}>No hay documentos no procesables</p>
              <p className={`${textSecondary} text-sm mt-2`}>
                Todos los documentos han sido procesados correctamente
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${bgSecondary} border-b ${border}`}>
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === documents.length && documents.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase cursor-pointer ${hoverRow} select-none`}
                      onClick={() => handleSort('filename')}
                    >
                      Archivo {sortField === 'filename' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Categoría</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Expediente</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Acción</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Grupo</th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase cursor-pointer ${hoverRow} select-none`}
                      onClick={() => handleSort('created_at')}
                    >
                      Fecha {sortField === 'created_at' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDocuments.map((doc) => {
                    const isSelected = selectedIds.has(doc.id);
                    const isDownloaded = downloadedIds.has(doc.id);
                    return (
                      <tr key={doc.id} className={`border-b ${border} ${hoverRow} ${isSelected ? 'bg-indigo-50' : ''}`}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(doc.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                        </td>
                        <td className={`px-4 py-3 text-sm ${textPrimary}`}>
                          <div className="max-w-xs truncate" title={doc.filename}>
                            {doc.filename}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getCategoryBadge(doc.rejection_category)}
                        </td>
                        <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                          {doc.numero_expediente || '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                          {doc.numero_accion || '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                          {doc.numero_grupo || '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${textSecondary}`}>
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

      {/* Modal de detalles con visor de PDF */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'bg-[#1e293b]' : 'bg-white'} rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
            {/* Header del modal */}
            <div className={`p-4 border-b ${border} flex items-center justify-between shrink-0`}>
              <div>
                <h2 className={`text-xl font-bold ${textPrimary}`}>Detalles del Documento</h2>
                <p className={`text-sm ${textSecondary} mt-1`}>{selectedDoc.filename}</p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Contenido principal - Layout lado a lado */}
            <div className="flex-1 overflow-hidden flex">
              {/* Panel izquierdo: Visor PDF/Imagen */}
              <div className={`w-1/2 border-r ${border} ${bgSecondary} flex flex-col`}>
                <div className={`p-2 ${bgSecondary} border-b ${border} text-sm font-medium ${textSecondary} flex items-center gap-2`}>
                  <span>{isImageFile(selectedDoc.filename, selectedDoc.file_type) ? '🖼️' : '📄'}</span>
                  Vista previa {isImageFile(selectedDoc.filename, selectedDoc.file_type) ? 'de imagen' : 'del PDF'}
                </div>
                <div className="flex-1 overflow-hidden flex items-center justify-center">
                  {selectedDoc.pdf_blob_url ? (
                    isImageFile(selectedDoc.filename, selectedDoc.file_type) ? (
                      <img
                        src={selectedDoc.pdf_blob_url}
                        alt={selectedDoc.filename}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : pdfBlobUrl ? (
                      <iframe
                        src={pdfBlobUrl}
                        className="w-full h-full border-0"
                        title={`Vista previa: ${selectedDoc.filename}`}
                      />
                    ) : (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <span className="text-4xl">📄</span>
                      <span className="text-sm">Archivo no disponible</span>
                      <span className="text-xs text-gray-300">El archivo original no fue guardado</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel derecho: Detalles */}
              <div className="w-1/2 overflow-auto p-4">
                <div className="space-y-4">
                  <div>
                    <label className={`text-sm font-medium ${textSecondary}`}>Categoría:</label>
                    <div className="mt-1">{getCategoryBadge(selectedDoc.rejection_category)}</div>
                  </div>

                  <div>
                    <label className={`text-sm font-medium ${textSecondary}`}>Motivo del rechazo:</label>
                    <p className={`${textPrimary} ${bgSecondary} p-3 rounded border ${border} mt-1 text-sm`}>
                      {selectedDoc.rejection_reason}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={`text-sm font-medium ${textSecondary}`}>Expediente:</label>
                      <p className={`${textPrimary} text-sm`}>{selectedDoc.numero_expediente || 'N/A'}</p>
                    </div>
                    <div>
                      <label className={`text-sm font-medium ${textSecondary}`}>Acción:</label>
                      <p className={`${textPrimary} text-sm`}>{selectedDoc.numero_accion || 'N/A'}</p>
                    </div>
                    <div>
                      <label className={`text-sm font-medium ${textSecondary}`}>Grupo:</label>
                      <p className={`${textPrimary} text-sm`}>{selectedDoc.numero_grupo || 'N/A'}</p>
                    </div>
                  </div>

                  {selectedDoc.extracted_data && Object.keys(selectedDoc.extracted_data).length > 0 && (
                    <div>
                      <label className={`text-sm font-medium ${textSecondary}`}>Datos extraídos:</label>
                      <pre className={`text-xs ${textPrimary} ${bgSecondary} p-3 rounded border ${border} mt-1 overflow-auto max-h-48`}>
                        {JSON.stringify(selectedDoc.extracted_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className={`text-sm ${textSecondary}`}>
                    Fecha: {new Date(selectedDoc.created_at).toLocaleString('es-ES')}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con acciones */}
            <div className={`p-4 border-t ${border} flex justify-between items-center shrink-0 ${bgSecondary}`}>
              <div className="text-sm text-gray-500">
                {selectedDoc.pdf_blob_url && (
                  <a
                    href={selectedDoc.pdf_blob_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir PDF en nueva pestaña
                  </a>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className={`px-4 py-2 ${isDarkMode ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} rounded-lg`}
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    handleSendToReview(selectedDoc.id);
                    setSelectedDoc(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Enviar a Revisión
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedDoc.id);
                    setSelectedDoc(null);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
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
