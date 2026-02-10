/**
 * ReviewListPage.tsx
 *
 * Pagina que muestra la lista de formularios que requieren revision.
 * Ruta: /review
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getExtractions, type ApiExtraction } from '../services/extractionAPI';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useLanguage } from '../contexts/LanguageContext';
import { getLanguageByCode } from '../config/languages';

interface ReviewListPageProps {
  isDarkMode?: boolean;
}

export default function ReviewListPage({ isDarkMode = false }: ReviewListPageProps) {
  const { t } = useTranslation(['review', 'common']);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLanguage } = useLanguage();

  // Theme variables
  const bgPrimary = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4f8]';
  const bgSecondary = isDarkMode ? 'bg-[#1e293b]' : 'bg-[#e8edf2]';
  const textPrimary = isDarkMode ? 'text-white' : 'text-[#1e293b]';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-[#475569]';
  const border = isDarkMode ? 'border-slate-700' : 'border-[#cbd5e1]';
  const bgCard = isDarkMode ? 'bg-[#1e293b]' : 'bg-white';
  const hoverRow = isDarkMode ? 'hover:bg-[#334155]' : 'hover:bg-[#f1f5f9]';

  const [extractions, setExtractions] = useState<ApiExtraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    needsReview: 0,
    valid: 0,
    rejected: 0
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'needs_review' | 'valid' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<'filename' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const options: any = {};
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
      } catch (error) {
        console.error('Error al cargar formularios:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [statusFilter]);

  // Local search filter + sort
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

  const handleSort = (field: 'filename' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; class: string }> = {
      pending: { text: t('review:list.filters.pending'), class: isDarkMode ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-800' },
      needs_review: { text: t('review:list.filters.needsReview'), class: isDarkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-800' },
      valid: { text: t('review:list.filters.valid'), class: isDarkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800' },
      rejected: { text: t('review:list.filters.rejected'), class: isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800' }
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className={`min-h-screen ${bgPrimary}`}>
      {/* Header */}
      <div className={`${bgCard} border-b ${border}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>
                {t('review:list.title')}
              </h1>
              <p className={`${textSecondary} mt-1`}>
                {t('review:list.subtitle')}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate('/')}
                className={`px-4 py-2 ${textSecondary} border ${border} rounded-lg ${hoverRow}`}
              >
                {t('review:list.back')}
              </button>
              <button
                onClick={() => navigate('/master-excel')}
                className="px-4 py-2 text-emerald-500 hover:text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 font-medium"
              >
                Excel Master
              </button>
              <button
                onClick={() => navigate('/unprocessable')}
                className="px-4 py-2 text-red-500 hover:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 font-medium"
              >
                No Procesables
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Total */}
          <div className={`${bgCard} rounded-lg shadow p-6 border ${border}`}>
            <div className="flex items-center">
              <div className={`p-3 ${isDarkMode ? 'bg-blue-900/40' : 'bg-blue-100'} rounded-full`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm ${textSecondary}`}>{t('review:list.stats.total')}</p>
                <p className={`text-2xl font-semibold ${textPrimary}`}>{stats.total}</p>
              </div>
            </div>
          </div>

          {/* Needs Review */}
          <div className={`${bgCard} rounded-lg shadow p-6 border ${border}`}>
            <div className="flex items-center">
              <div className={`p-3 ${isDarkMode ? 'bg-red-900/40' : 'bg-red-100'} rounded-full`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm ${textSecondary}`}>{t('review:list.stats.needsReview')}</p>
                <p className={`text-2xl font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{stats.needsReview}</p>
                <p className={`text-xs ${textSecondary} mt-1`}>{stats.total > 0 ? ((stats.needsReview / stats.total) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          </div>

          {/* Valid */}
          <div className={`${bgCard} rounded-lg shadow p-6 border ${border}`}>
            <div className="flex items-center">
              <div className={`p-3 ${isDarkMode ? 'bg-green-900/40' : 'bg-green-100'} rounded-full`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm ${textSecondary}`}>{t('review:list.stats.valid')}</p>
                <p className={`text-2xl font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{stats.valid}</p>
                <p className={`text-xs ${textSecondary} mt-1`}>{stats.total > 0 ? ((stats.valid / stats.total) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          </div>

          {/* Rejected */}
          <div className={`${bgCard} rounded-lg shadow p-6 border ${border}`}>
            <div className="flex items-center">
              <div className={`p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full`}>
                <svg className={`w-6 h-6 ${textSecondary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm ${textSecondary}`}>{t('review:list.stats.rejected')}</p>
                <p className={`text-2xl font-semibold ${textSecondary}`}>{stats.rejected}</p>
                <p className={`text-xs ${textSecondary} mt-1`}>{stats.total > 0 ? ((stats.rejected / stats.total) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${bgCard} rounded-lg shadow p-4 mb-6 border ${border}`}>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status Filter Buttons */}
            <div className="flex-1">
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                {t('review:list.table.status')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: t('review:list.filters.all') },
                  { value: 'pending', label: t('review:list.filters.pending') },
                  { value: 'needs_review', label: t('review:list.filters.needsReview') },
                  { value: 'valid', label: t('review:list.filters.valid') },
                  { value: 'rejected', label: t('review:list.filters.rejected') }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStatusFilter(option.value as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === option.value
                        ? 'bg-indigo-600 text-white'
                        : isDarkMode
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                {t('common:buttons.search')}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common:buttons.search')}
                className={`w-full px-4 py-2 border ${border} rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${bgCard} ${textPrimary}`}
              />
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className={textSecondary}>{t('common:status.loading')}</p>
            </div>
          </div>
        ) : filteredExtractions.length === 0 ? (
          <div className={`${bgCard} rounded-lg shadow p-12 text-center border ${border}`}>
            <h3 className={`text-xl font-semibold ${textPrimary} mb-2`}>
              {t('review:list.table.noData')}
            </h3>
            <p className={textSecondary}>
              {statusFilter === 'needs_review'
                ? 'No hay formularios que requieran revision en este momento.'
                : 'No se encontraron formularios con los filtros seleccionados.'}
            </p>
          </div>
        ) : (
          <div className={`${bgCard} rounded-lg shadow overflow-hidden border ${border}`}>
            <table className={`min-w-full divide-y ${border}`}>
              <thead className={bgSecondary}>
                <tr>
                  <th
                    className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider cursor-pointer ${hoverRow} select-none`}
                    onClick={() => handleSort('filename')}
                  >
                    {t('review:list.table.filename')} {sortField === 'filename' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider cursor-pointer ${hoverRow} select-none`}
                    onClick={() => handleSort('created_at')}
                  >
                    {t('review:list.table.date')} {sortField === 'created_at' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider`}>
                    {t('review:list.table.status')}
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider`}>
                    {t('review:panel.validationErrors')}
                  </th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${textSecondary} uppercase tracking-wider`}>
                    {t('review:list.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className={`${bgCard} divide-y ${border}`}>
                {filteredExtractions.map((extraction) => {
                  const badge = getStatusBadge(extraction.status);
                  const errorCount = extraction.validation_errors?.length || 0;

                  return (
                    <tr
                      key={extraction.id}
                      className={`${hoverRow} cursor-pointer transition-colors`}
                      onClick={() => navigate(`/review/${extraction.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 ${bgSecondary} rounded-lg flex items-center justify-center`}>
                            <svg className={`h-6 w-6 ${textSecondary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${textPrimary}`}>
                              {extraction.filename}
                            </div>
                            <div className={`text-sm ${textSecondary}`}>
                              {((extraction.file_size_bytes || 0) / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${textSecondary}`}>
                        {new Date(extraction.created_at).toLocaleString(getLanguageByCode(currentLanguage).locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.class}`}>
                          {badge.text}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {extraction.status === 'rejected' && extraction.rejection_reason ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'}`} title={extraction.rejection_reason}>
                            Rechazado: {extraction.rejection_reason.length > 30
                              ? extraction.rejection_reason.substring(0, 30) + '...'
                              : extraction.rejection_reason}
                          </span>
                        ) : errorCount > 0 ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-800'}`}>
                            {errorCount} {errorCount === 1 ? 'error' : 'errores'}
                          </span>
                        ) : (
                          <span className={`text-sm ${textSecondary}`}>Sin errores</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/review/${extraction.id}`);
                          }}
                          className="text-indigo-500 hover:text-indigo-400 font-medium"
                        >
                          {errorCount > 0 ? t('review:list.actions.review') + ' →' : t('review:list.actions.review') + ' →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Count info */}
        {filteredExtractions.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className={`text-sm ${textSecondary}`}>
              Mostrando {filteredExtractions.length} de {extractions.length} formularios
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
