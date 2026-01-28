/**
 * ReviewListPage.tsx
 *
 * Página que muestra la lista de formularios FUNDAE que requieren revisión.
 * Ruta: /review
 *
 * Muestra:
 * - Formularios con errores de validación pendientes
 * - Estadísticas generales
 * - Filtros y búsqueda
 * - Acceso directo a revisar cada formulario
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExtractions, rejectExtraction, type ApiExtraction } from '../services/extractionAPI';
import { useAuth } from '../contexts/AuthContext.tsx';
import PinModal, { requiresPin } from './PinModal.tsx';

export default function ReviewListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [extractions, setExtractions] = useState<ApiExtraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    needsReview: 0,
    valid: 0,
    rejected: 0
  });

  // NUEVO: Contador total fijo (editable por admin)
  const [fixedTotal, setFixedTotal] = useState<number | null>(null);
  const [showEditTotalModal, setShowEditTotalModal] = useState(false);
  const [newTotalValue, setNewTotalValue] = useState('');
  const [savingTotal, setSavingTotal] = useState(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'needs_review' | 'valid' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Ordenación
  const [sortField, setSortField] = useState<'filename' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selección múltiple y acciones en bloque
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  // PIN Modal para eliminar
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);

  // NUEVO: Cargar contador fijo desde BD
  useEffect(() => {
    async function loadFixedTotal() {
      try {
        const response = await fetch('/api/settings/total-counter', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setFixedTotal(data.value);
        }
      } catch (error) {
        console.error('Error cargando contador total:', error);
      }
    }
    loadFixedTotal();
  }, []);

  // Cargar formularios
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Cargar formularios según filtro
        const options: any = { limit: 100 };
        if (statusFilter === 'needs_review') {
          options.needsReview = true;
        } else if (statusFilter === 'pending') {
          options.status = 'pending';
        } else if (statusFilter !== 'all') {
          options.status = statusFilter;
        }

        const data = await getExtractions(options);
        setExtractions(data.extractions);
        setStats(data.stats);

        console.log('✅ Formularios cargados:', data.extractions.length);
      } catch (error) {
        console.error('Error al cargar formularios:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [statusFilter]);

  // Filtrar por búsqueda local
  const filteredExtractions = extractions
    .filter(ex => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        ex.filename.toLowerCase().includes(query) ||
        ex.id.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aValue = sortField === 'filename' ? a.filename.toLowerCase() : new Date(a.created_at).getTime();
      const bValue = sortField === 'filename' ? b.filename.toLowerCase() : new Date(b.created_at).getTime();
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Función para cambiar ordenación
  const handleSort = (field: 'filename' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Función auxiliar para obtener badge de status
  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' },
      needs_review: { text: 'Requiere Revisión', class: 'bg-red-100 text-red-800' },
      valid: { text: 'Válido', class: 'bg-green-100 text-green-800' },
      rejected: { text: 'Rechazado', class: 'bg-gray-100 text-gray-800' }
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  // Manejo de selección
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredExtractions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExtractions.map(ex => ex.id)));
    }
  };

  // NUEVO: Guardar contador fijo (solo admin)
  const handleSaveTotal = async () => {
    const value = parseInt(newTotalValue, 10);
    if (isNaN(value) || value < 0) {
      alert('Introduce un número válido');
      return;
    }

    try {
      setSavingTotal(true);
      const response = await fetch('/api/settings/total-counter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value })
      });

      if (response.ok) {
        setFixedTotal(value);
        setShowEditTotalModal(false);
        setNewTotalValue('');
      } else {
        const data = await response.json();
        alert(data.error || 'Error al guardar');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setSavingTotal(false);
    }
  };

  // Acción masiva: Eliminar documentos definitivamente
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`⚠️ ¿ELIMINAR DEFINITIVAMENTE ${selectedIds.size} documentos? Esta acción NO se puede deshacer y borrará todos los datos.`)) {
      return;
    }

    // Si el usuario requiere PIN, mostrar modal
    if (requiresPin(user?.email)) {
      setPendingDeleteAction(() => executeDelete);
      setShowPinModal(true);
      return;
    }

    // Si no requiere PIN, ejecutar directamente
    executeDelete();
  };

  const executeDelete = async () => {
    try {
      setProcessing(true);
      const idsToProcess = Array.from(selectedIds);
      const CONCURRENCY = 3;
      let successCount = 0;
      let failCount = 0;

      const processItem = async (id: string) => {
        try {
          // DELETE /api/extractions/:id/delete
          const response = await fetch(`/api/extractions/${id}/delete`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!response.ok) throw new Error('Falló eliminación');
          return true;
        } catch (error) {
          console.error(`❌ Falló eliminación para ${id}:`, error);
          return false;
        }
      };

      for (let i = 0; i < idsToProcess.length; i += CONCURRENCY) {
        const chunk = idsToProcess.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(processItem));
        successCount += results.filter(Boolean).length;
        failCount += results.filter(r => !r).length;
      }

      if (failCount > 0) {
        alert(`⚠️ Proceso finalizado con advertencias:\n✅ ${successCount} eliminados\n❌ ${failCount} fallaron`);
      } else {
        alert(`✅ ${successCount} documentos eliminados correctamente.`);
      }

      setSelectedIds(new Set());
      const options: any = { limit: 100 };
      if (statusFilter !== 'all') options.status = statusFilter === 'needs_review' ? undefined : statusFilter;
      if (statusFilter === 'needs_review') options.needsReview = true;

      const data = await getExtractions(options);
      setExtractions(data.extractions);
      setStats(data.stats);

    } catch (error) {
      console.error('Error crítico en eliminación masiva:', error);
      alert('Error crítico. Intenta recargar la página.');
    } finally {
      setProcessing(false);
    }
  };

  // Acción masiva: Anular/Eliminar documentos
  // - Si el documento está en extraction_results → lo rechaza y mueve a unprocessable
  // - Si el documento YA está en unprocessable_documents → lo elimina directamente
  const handleBulkAnulate = async () => {
    if (selectedIds.size === 0) return;

    // Separar documentos por origen
    const extractionDocs = extractions.filter(ex => selectedIds.has(ex.id) && ex.source !== 'unprocessable');
    const unprocessableDocs = extractions.filter(ex => selectedIds.has(ex.id) && ex.source === 'unprocessable');

    let message = `¿Qué deseas hacer con los ${selectedIds.size} documentos seleccionados?\n\n`;
    if (extractionDocs.length > 0) {
      message += `• ${extractionDocs.length} documentos de extracciones → Se moverán a "No Procesables"\n`;
    }
    if (unprocessableDocs.length > 0) {
      message += `• ${unprocessableDocs.length} documentos YA en "No Procesables" → Se ELIMINARÁN definitivamente\n`;
    }

    if (!confirm(message)) {
      return;
    }

    const reason = prompt('Motivo (opcional):') || 'Anulación/eliminación manual';

    try {
      setProcessing(true);
      let successCount = 0;
      let failCount = 0;
      const CONCURRENCY = 3;

      // 1. Procesar documentos de extraction_results (anular → mover a unprocessable)
      if (extractionDocs.length > 0) {
        const processExtraction = async (extraction: typeof extractions[0]) => {
          try {
            // Registrar en unprocessable_documents
            try {
              await fetch('/api/unprocessable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  filename: extraction.filename,
                  category: 'manual_anulado_bulk',
                  reason,
                  extractedData: extraction.extracted_data
                })
              });
            } catch (e) {
              console.warn(`Error registrando unprocessable para ${extraction.id}:`, e);
            }

            // Marcar como rechazada en extraction_results
            await rejectExtraction(extraction.id, reason);
            return true;
          } catch (error) {
            console.error(`❌ Falló anulación para ${extraction.id}:`, error);
            return false;
          }
        };

        for (let i = 0; i < extractionDocs.length; i += CONCURRENCY) {
          const chunk = extractionDocs.slice(i, i + CONCURRENCY);
          const results = await Promise.all(chunk.map(processExtraction));
          successCount += results.filter(Boolean).length;
          failCount += results.filter(r => !r).length;
        }
      }

      // 2. Procesar documentos YA en unprocessable_documents (eliminar)
      if (unprocessableDocs.length > 0) {
        const deleteUnprocessable = async (doc: typeof extractions[0]) => {
          try {
            const response = await fetch(`/api/unprocessable?id=${doc.id}`, {
              method: 'DELETE',
              credentials: 'include'
            });
            if (!response.ok) throw new Error('Error eliminando');
            return true;
          } catch (error) {
            console.error(`❌ Falló eliminación de no procesable ${doc.id}:`, error);
            return false;
          }
        };

        for (let i = 0; i < unprocessableDocs.length; i += CONCURRENCY) {
          const chunk = unprocessableDocs.slice(i, i + CONCURRENCY);
          const results = await Promise.all(chunk.map(deleteUnprocessable));
          successCount += results.filter(Boolean).length;
          failCount += results.filter(r => !r).length;
        }
      }

      if (failCount > 0) {
        alert(`⚠️ Proceso finalizado:\n✅ ${successCount} procesados correctamente\n❌ ${failCount} fallaron`);
      } else {
        alert(`✅ ${successCount} documentos procesados correctamente.`);
      }

      // Recargar datos
      setSelectedIds(new Set());
      const options: any = { limit: 100 };
      if (statusFilter !== 'all') options.status = statusFilter === 'needs_review' ? undefined : statusFilter;
      if (statusFilter === 'needs_review') options.needsReview = true;

      const data = await getExtractions(options);
      setExtractions(data.extractions);
      setStats(data.stats);

    } catch (error) {
      console.error('Error crítico en proceso masivo:', error);
      alert('Error crítico. Intenta recargar la página.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Formularios FUNDAE - Revisión
              </h1>
              <p className="text-gray-600 mt-1">
                Revisa y corrige formularios con errores de validación
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Volver al inicio
              </button>
              <button
                onClick={() => navigate('/master-excel')}
                className="px-4 py-2 text-emerald-600 hover:text-emerald-900 border border-emerald-200 rounded-lg hover:bg-emerald-50 font-medium"
              >
                📊 Excel Master
              </button>
              <button
                onClick={() => navigate('/unprocessable')}
                className="px-4 py-2 text-red-600 hover:text-red-900 border border-red-200 rounded-lg hover:bg-red-50 font-medium"
              >
                ⚠️ No Procesables
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Card Total - MODIFICADA para mostrar contador fijo */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {fixedTotal !== null ? fixedTotal : stats.total}
                </p>
              </div>
              {user?.role === 'admin' && (
                <button
                  onClick={() => {
                    setNewTotalValue(String(fixedTotal ?? stats.total));
                    setShowEditTotalModal(true);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Editar contador total"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Requieren Revisión</p>
                <p className="text-2xl font-semibold text-red-600">{stats.needsReview}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Válidos</p>
                <p className="text-2xl font-semibold text-green-600">{stats.valid}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-full">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Rechazados</p>
                <p className="text-2xl font-semibold text-gray-600">{stats.rejected}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'pending', label: 'Pendientes' },
                  { value: 'needs_review', label: 'Con Errores' },
                  { value: 'valid', label: 'Válidos' },
                  { value: 'rejected', label: 'Rechazados' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStatusFilter(option.value as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === option.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o ID..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Lista de formularios */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando formularios...</p>
            </div>
          </div>
        ) : filteredExtractions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay formularios
            </h3>
            <p className="text-gray-600">
              {statusFilter === 'needs_review'
                ? 'No hay formularios que requieran revisión en este momento.'
                : 'No se encontraron formularios con los filtros seleccionados.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Barra de acciones en bloque */}
            {selectedIds.size > 0 && (
              <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex items-center justify-between">
                <div className="text-sm text-indigo-800 font-medium">
                  {selectedIds.size} documentos seleccionados
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkAnulate}
                    disabled={processing}
                    className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                    Anular
                  </button>
                  {/* En "Todos" solo test@test.eu puede eliminar */}
                  {(statusFilter !== 'all' || user?.email === 'test@test.eu') && (
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
                      Eliminar Definitivamente
                    </button>
                  )}
                </div>
              </div>
            )}

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredExtractions.length && filteredExtractions.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('filename')}
                  >
                    Archivo {sortField === 'filename' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('created_at')}
                  >
                    Fecha {sortField === 'created_at' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errores
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExtractions.map((extraction) => {
                  const badge = getStatusBadge(extraction.status);
                  const errorCount = extraction.validation_errors?.length || 0;
                  const isSelected = selectedIds.has(extraction.id);

                  return (
                    <tr
                      key={extraction.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-indigo-50' : ''}`}
                      onClick={() => navigate(`/review/${extraction.id}`)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(extraction.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {extraction.filename}
                            </div>
                            <div className="text-sm text-gray-500">
                              {((extraction.file_size_bytes || 0) / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(extraction.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.class}`}>
                          {badge.text}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {extraction.status === 'rejected' && extraction.rejection_reason ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800" title={extraction.rejection_reason}>
                            Rechazado: {extraction.rejection_reason.length > 30
                              ? extraction.rejection_reason.substring(0, 30) + '...'
                              : extraction.rejection_reason}
                          </span>
                        ) : errorCount > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {errorCount} {errorCount === 1 ? 'error' : 'errores'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">Sin errores</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/review/${extraction.id}`);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          {errorCount > 0 ? 'Revisar →' : 'Ver detalles →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación (placeholder) */}
        {filteredExtractions.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando {filteredExtractions.length} de {extractions.length} formularios
            </p>
            <div className="flex gap-2">
              <button
                disabled
                className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                disabled
                className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

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

      {/* Modal editar contador total */}
      {showEditTotalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Editar contador Total</h3>
            <input
              type="number"
              value={newTotalValue}
              onChange={(e) => setNewTotalValue(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              placeholder="Nuevo valor"
              min="0"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEditTotalModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTotal}
                disabled={savingTotal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTotal ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
