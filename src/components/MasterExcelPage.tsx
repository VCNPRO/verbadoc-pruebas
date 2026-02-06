/**
 * MasterExcelPage.tsx
 *
 * Pagina para ver todos los formularios procesados y descargar el Excel master
 * Ruta: /master-excel
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { PdfViewerOptimized } from './PdfViewerOptimized';

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

interface MasterExcelPageProps {
  isDarkMode?: boolean;
}

export default function MasterExcelPage({ isDarkMode = false }: MasterExcelPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Theme variables
  const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
  const bgSecondary = isDarkMode ? 'bg-[#1e293b]' : 'bg-[#e8edf2]';
  const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
  const border = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';
  const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const hoverRow = isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]';

  const [rows, setRows] = useState<MasterExcelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<'filename' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'filename' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const aValue = sortField === 'filename' ? a.filename.toLowerCase() : new Date(a.created_at).getTime();
    const bValue = sortField === 'filename' ? b.filename.toLowerCase() : new Date(b.created_at).getTime();
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const [viewingRow, setViewingRow] = useState<MasterExcelRow | null>(null);

  // Inline editing state and PDF viewer in modal
  const [modalPdfUrl, setModalPdfUrl] = useState<string | null>(null);
  const [modalEditingField, setModalEditingField] = useState<string | null>(null);
  const [modalEditValue, setModalEditValue] = useState('');
  const [savingField, setSavingField] = useState(false);

  // Load PDF when modal opens
  useEffect(() => {
    if (!viewingRow) {
      setModalPdfUrl(null);
      setModalEditingField(null);
      return;
    }

    const loadPdf = async () => {
      try {
        const response = await fetch(`/api/extractions/${viewingRow.extraction_id}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          const url = data.extraction?.pdf_blob_url || data.extraction?.file_url;
          if (url) {
            setModalPdfUrl(url);
            return;
          }
        }
      } catch (e) {
        console.warn('No se pudo cargar PDF de la extraccion:', e);
      }
      const pdfData = sessionStorage.getItem(`pdf_${viewingRow.extraction_id}`);
      if (pdfData) {
        try {
          const base64Content = pdfData.split(',')[1] || pdfData;
          const byteCharacters = atob(base64Content.replace(/\s/g, ''));
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
          setModalPdfUrl(URL.createObjectURL(blob));
        } catch (e) {
          console.warn('Error decodificando PDF de sessionStorage:', e);
        }
      }
    };

    loadPdf();

    return () => {
      if (modalPdfUrl && modalPdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(modalPdfUrl);
      }
    };
  }, [viewingRow?.id]);

  // Save edited field in modal
  const handleModalSaveField = async (key: string) => {
    if (!viewingRow) return;
    try {
      setSavingField(true);
      const updatedData = { ...viewingRow.row_data, [key]: modalEditValue };

      const response = await fetch(`/api/master-excel/${viewingRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ row_data: updatedData })
      });

      if (!response.ok) throw new Error('Error al guardar');

      const updatedRow = { ...viewingRow, row_data: updatedData };
      setViewingRow(updatedRow);
      setRows(prev => prev.map(r => r.id === viewingRow.id ? updatedRow : r));
      setModalEditingField(null);
    } catch (err: any) {
      console.error('Error al guardar campo:', err);
      alert('Error al guardar el campo. Intenta de nuevo.');
    } finally {
      setSavingField(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
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

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Master_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error al descargar:', err);
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className={`${bgCard} border-b ${border}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>
                Excel
              </h1>
              <p className={`${textSecondary} mt-1`}>
                Todos los formularios procesados listos para exportar
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className={`px-4 py-2 ${textSecondary} hover:${textPrimary} border ${border} rounded-lg ${hoverRow}`}
              >
                ← Volver al inicio
              </button>

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
                    'Descargar Excel'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
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
              className={`w-full px-3 py-2 border ${border} rounded-md ${bgCard} ${textPrimary}`}
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
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className={`${bgCard} border ${border} rounded-lg overflow-hidden`}>
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className={textSecondary}>Cargando formularios...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <p className={`${textSecondary} text-lg`}>No hay formularios procesados</p>
              <p className={`${textSecondary} text-sm mt-2`}>
                Los formularios que proceses apareceran aqui automaticamente
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${bgSecondary} border-b ${border}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>#</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Expediente</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>CIF</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Empresa</th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase cursor-pointer ${hoverRow} select-none`}
                      onClick={() => handleSort('filename')}
                    >
                      Archivo {sortField === 'filename' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase cursor-pointer ${hoverRow} select-none`}
                      onClick={() => handleSort('created_at')}
                    >
                      Fecha {sortField === 'created_at' && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                    <th className={`px-4 py-3 text-right text-xs font-medium ${textSecondary} uppercase`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b ${border} ${hoverRow} transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm ${textPrimary}`}>{row.row_number}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${textPrimary}`}>
                        {row.row_data?.numero_expediente || 'N/A'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                        {row.row_data?.nif_empresa || 'N/A'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                        {row.row_data?.razon_social?.substring(0, 30) || 'N/A'}
                        {row.row_data?.razon_social?.length > 30 && '...'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                        {row.filename.substring(0, 25)}
                        {row.filename.length > 25 && '...'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                        {new Date(row.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setViewingRow(row)}
                          className="text-indigo-500 hover:text-indigo-400 p-1 rounded transition-colors"
                          title="Ver datos del formulario"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Data Viewer with PDF */}
      {viewingRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bgCard} rounded-xl shadow-2xl w-[95vw] max-w-[1400px] h-[90vh] overflow-hidden flex flex-col`}>
            {/* Modal Header */}
            <div className={`${bgSecondary} px-6 py-4 border-b ${border} flex items-center justify-between flex-shrink-0`}>
              <div>
                <h3 className={`text-lg font-semibold ${textPrimary}`}>
                  Datos del Formulario
                </h3>
                <p className={`text-sm ${textSecondary} mt-1`}>
                  {viewingRow.filename} - Expediente: {viewingRow.row_data?.numero_expediente || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setViewingRow(null)}
                className={`p-2 ${hoverRow} rounded-lg transition-colors`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${textSecondary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content 50/50: PDF left + Editable data right */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: PDF Viewer (50%) */}
              <div className={`w-1/2 h-full ${bgSecondary} border-r ${border} flex items-center justify-center`}>
                {modalPdfUrl ? (
                  <PdfViewerOptimized
                    pdfUrl={modalPdfUrl}
                    highlights={[]}
                    currentErrorId={null}
                    onHighlightClick={() => {}}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="text-center p-8">
                    <div className={`${textSecondary} text-5xl mb-4`}>📄</div>
                    <p className={`${textSecondary} font-medium`}>PDF no disponible</p>
                    <p className={`${textSecondary} text-sm mt-1`}>No se encontro el archivo original</p>
                  </div>
                )}
              </div>

              {/* Right: Editable table (50%) */}
              <div className="w-1/2 h-full flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4">
                  <div className={`${bgSecondary} rounded-lg border ${border} overflow-hidden`}>
                    <table className="w-full">
                      <thead className={`${isDarkMode ? 'bg-[#334155]' : 'bg-[#dde3ea]'} sticky top-0`}>
                        <tr>
                          <th className={`px-2 py-2 text-center text-xs font-semibold ${textSecondary} uppercase w-12`}></th>
                          <th className={`px-3 py-2 text-left text-xs font-semibold ${textSecondary} uppercase w-1/3`}>Campo</th>
                          <th className={`px-3 py-2 text-left text-xs font-semibold ${textSecondary} uppercase`}>Valor</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${border}`}>
                        {viewingRow.row_data && Object.entries(viewingRow.row_data)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([key, value]) => (
                            <tr key={key} className={`${hoverRow} transition-colors`}>
                              <td className="px-2 py-2 text-center">
                                {modalEditingField === key ? (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleModalSaveField(key)}
                                      disabled={savingField}
                                      className="px-1.5 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                      title="Guardar"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => setModalEditingField(null)}
                                      className="px-1.5 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                      title="Cancelar"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setModalEditingField(key);
                                      setModalEditValue(String(value ?? ''));
                                    }}
                                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    title="Editar campo"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </td>
                              <td className={`px-3 py-2 text-xs font-mono ${textSecondary}`}>
                                {key}
                              </td>
                              <td className={`px-3 py-2 text-sm ${textPrimary}`}>
                                {modalEditingField === key ? (
                                  <input
                                    type="text"
                                    value={modalEditValue}
                                    onChange={(e) => setModalEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleModalSaveField(key);
                                      if (e.key === 'Escape') setModalEditingField(null);
                                    }}
                                    className={`w-full px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${bgCard} ${textPrimary}`}
                                    autoFocus
                                  />
                                ) : (
                                  value === null || value === undefined || value === 'null'
                                    ? <span className={`${textSecondary} italic`}>-</span>
                                    : typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : String(value)
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Metadata */}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className={`${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-lg p-3`}>
                      <span className="text-blue-400 font-medium">Estado:</span>
                      <span className={`ml-2 ${textPrimary}`}>{viewingRow.validation_status}</span>
                    </div>
                    <div className={`${isDarkMode ? 'bg-green-900/30' : 'bg-green-50'} rounded-lg p-3`}>
                      <span className="text-green-400 font-medium">Validacion cruzada:</span>
                      <span className={`ml-2 ${textPrimary}`}>
                        {viewingRow.cross_validation_match ? 'Coincide' : 'No coincide'}
                      </span>
                    </div>
                    <div className={`${bgSecondary} rounded-lg p-3`}>
                      <span className={`${textSecondary} font-medium`}>Version:</span>
                      <span className={`ml-2 ${textPrimary}`}>{viewingRow.version}</span>
                    </div>
                    <div className={`${bgSecondary} rounded-lg p-3`}>
                      <span className={`${textSecondary} font-medium`}>Fecha:</span>
                      <span className={`ml-2 ${textPrimary}`}>
                        {new Date(viewingRow.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className={`${bgSecondary} px-4 py-3 border-t ${border} flex justify-end flex-shrink-0`}>
                  <button
                    onClick={() => setViewingRow(null)}
                    className={`px-6 py-2 ${isDarkMode ? 'bg-slate-600 hover:bg-slate-500' : 'bg-gray-200 hover:bg-gray-300'} ${textPrimary} font-medium rounded-lg transition-colors`}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
