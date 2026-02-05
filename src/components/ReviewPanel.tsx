/**
 * ReviewPanel.tsx
 *
 * Componente principal para revisar formularios FUNDAE con errores de validación.
 *
 * Layout:
 * ┌─────────────────────┬─────────────────────┐
 * │                     │                     │
 * │   Visor PDF         │   Panel Errores     │
 * │   (izquierda)       │   (derecha)         │
 * │                     │                     │
 * │   📄 Documento      │   ❌ Error #1       │
 * │   con highlights    │   ✏️  [Corregir]    │
 * │                     │                     │
 * │                     │   ❌ Error #2       │
 * │                     │   ✏️  [Corregir]    │
 * │                     │                     │
 * └─────────────────────┴─────────────────────┘
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getExtraction,
  approveExtraction,
  rejectExtraction,
  fixValidationError,
  ignoreValidationError,
  type ApiExtraction,
  type ApiValidationError
} from '../services/extractionAPI';
import { PdfViewerOptimized, type PdfHighlight } from './PdfViewerOptimized';

interface ReviewPanelProps {
  // Modo: 'single' para revisar uno específico, 'list' para mostrar lista
  mode?: 'single' | 'list';
}

export default function ReviewPanel({ mode = 'single' }: ReviewPanelProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [extraction, setExtraction] = useState<ApiExtraction | null>(null);
  const [errors, setErrors] = useState<ApiValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  // 🔥 NUEVO: Estado para PDF cargado desde sessionStorage
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Estado para el modal de corrección de errores
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingError, setEditingError] = useState<ApiValidationError | null>(null);
  const [correctedValue, setCorrectedValue] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');

  // Estado para edición inline de campos
  const [inlineEditField, setInlineEditField] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  // Determinar opciones de dropdown según el campo
  const getFieldOptions = (key: string): string[] | null => {
    const k = key.toLowerCase();

    // Binario
    if (k === 'valoracion_8_1' || k === 'valoracion_8_2' || k === 'recomendaria_curso') {
      return ['NC', 'Sí', 'No'];
    }
    // Teleformación
    if (k === 'valoracion_7_1' || k === 'valoracion_7_2') {
      return ['NC', '1', '2', '3', '4', 'NA'];
    }
    // Valoración genérica
    if (k.startsWith('valoracion_')) {
      return ['NC', '1', '2', '3', '4'];
    }
    // Sexo
    if (k === 'sexo') return ['NC', '1', '2', '9'];
    // Modalidad
    if (k === 'modalidad') return ['NC', 'Presencial', 'Teleformación', 'Mixta'];
    // Categoría profesional
    if (k === 'categoria_profesional') return ['NC', '1', '2', '3', '4', '5', '6', '9'];
    // Horario
    if (k === 'horario_curso') return ['NC', '1', '2', '3', '9'];
    // Porcentaje jornada
    if (k === 'porcentaje_jornada') return ['NC', '1', '2', '3', '9'];
    // Tamaño empresa
    if (k === 'tamano_empresa') return ['NC', '1', '2', '3', '4', '5', '9'];

    return null; // Texto libre
  };

  // Iniciar edición inline
  const handleStartInlineEdit = (key: string, value: any) => {
    setInlineEditField(key);
    setInlineEditValue(String(value ?? ''));
  };

  // Guardar edición inline
  const handleSaveInlineEdit = (key: string, newValue: string) => {
    if (!extraction) return;

    const updatedData = {
      ...extraction.extracted_data,
      [key]: newValue
    };

    setExtraction({
      ...extraction,
      extracted_data: updatedData
    });

    setInlineEditField(null);
    setInlineEditValue('');
    console.log(`✅ Campo "${key}" actualizado a: "${newValue}"`);
  };

  // Cancelar edición inline
  const handleCancelInlineEdit = () => {
    setInlineEditField(null);
    setInlineEditValue('');
  };

  // Renderizar celda de valor (inline edit o texto)
  const renderValueCell = (key: string, value: any) => {
    if (inlineEditField === key) {
      const options = getFieldOptions(key);
      if (options) {
        return (
          <select
            value={inlineEditValue}
            onChange={(e) => handleSaveInlineEdit(key, e.target.value)}
            onBlur={handleCancelInlineEdit}
            autoFocus
            className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          >
            {!options.includes(String(value ?? '')) && (
              <option value={String(value ?? '')}>{String(value ?? '(vacío)')}</option>
            )}
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      // Texto libre: input inline
      return (
        <input
          type="text"
          value={inlineEditValue}
          onChange={(e) => setInlineEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveInlineEdit(key, inlineEditValue);
            if (e.key === 'Escape') handleCancelInlineEdit();
          }}
          onBlur={handleCancelInlineEdit}
          autoFocus
          className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      );
    }

    // Modo lectura: click para editar
    return (
      <span
        onClick={() => handleStartInlineEdit(key, value)}
        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded transition-colors"
        title="Click para editar"
      >
        {String(value ?? '-')}
      </span>
    );
  };

  // Generar highlights para el PDF basados en errores de validación
  const pdfHighlights = useMemo<PdfHighlight[]>(() => {
    if (!errors || errors.length === 0) return [];

    return errors
      .filter((error) => {
        // SOLO mostrar highlights si el error tiene coordenadas reales del PDF
        // Si no tiene field_position, no mostrar nada (evita rectángulos falsos)
        return error.field_position &&
               error.field_position.x !== undefined &&
               error.field_position.y !== undefined;
      })
      .map((error) => {
      // Mapear posiciones estimadas según el campo (SOLO para fallback, no se usará normalmente)
      const fieldPositions: Record<string, { x: number; y: number; width: number; height: number; page: number }> = {
        // Sección I (página 1)
        'expediente': { x: 0.15, y: 0.15, width: 0.30, height: 0.04, page: 1 },
        'cif': { x: 0.15, y: 0.22, width: 0.25, height: 0.04, page: 1 },
        'denominacion_aaff': { x: 0.15, y: 0.28, width: 0.50, height: 0.04, page: 1 },

        // Sección II (página 1)
        'edad': { x: 0.15, y: 0.40, width: 0.15, height: 0.04, page: 1 },
        'sexo': { x: 0.35, y: 0.40, width: 0.15, height: 0.04, page: 1 },
        'titulacion': { x: 0.15, y: 0.46, width: 0.35, height: 0.04, page: 1 },
        'lugar_trabajo': { x: 0.15, y: 0.52, width: 0.30, height: 0.04, page: 1 },
        'categoria_profesional': { x: 0.15, y: 0.58, width: 0.35, height: 0.04, page: 1 },

        // Valoraciones (página 2)
        'valoracion_1': { x: 0.70, y: 0.20, width: 0.10, height: 0.03, page: 2 },
        'valoracion_2': { x: 0.70, y: 0.25, width: 0.10, height: 0.03, page: 2 },
        'valoracion_3': { x: 0.15, y: 0.65, width: 0.40, height: 0.04, page: 2 },
      };

      // Obtener posición del campo o usar posición por defecto
      const position = fieldPositions[error.field_name.toLowerCase()] || {
        x: 0.15,
        y: 0.20,
        width: 0.30,
        height: 0.04,
        page: 1,
      };

      return {
        id: error.id,
        pageNumber: position.page,
        fieldName: error.field_name,
        errorType: error.error_type,
        errorMessage: error.error_message,
        severity: error.severity,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      };
    });
  }, [errors]);

  // Handler cuando se hace click en un highlight del PDF
  const handleHighlightClick = (highlight: PdfHighlight) => {
    // Encontrar el índice del error correspondiente
    const errorIndex = errors.findIndex((e) => e.id === highlight.id);
    if (errorIndex !== -1) {
      setCurrentErrorIndex(errorIndex);
    }
  };

  // Cargar datos de la extracción
  useEffect(() => {
    if (!id) return;

    async function loadData() {
      try {
        setLoading(true);
        const data = await getExtraction(id!);
        setExtraction(data.extraction);
        setErrors(data.errors || []);
        console.log('✅ Datos cargados:', data);

        // 🔥 CORREGIDO: Cargar PDF desde múltiples fuentes con mejor manejo
        const pdfKey = `pdf_${id}`;
        let pdfLoaded = false;

        // 1. Intentar desde Base de Datos primero (más confiable)
        // Buscar en pdf_blob_url Y file_url por compatibilidad
        const pdfUrlFromDb = data.extraction.pdf_blob_url || data.extraction.file_url;

        if (pdfUrlFromDb) {
          console.log('🔍 Intentando cargar PDF desde Base de Datos...');
          console.log('   URL:', pdfUrlFromDb.substring(0, 80) + '...');
          try {
            // Verificar que la URL sea accesible
            const testResponse = await fetch(pdfUrlFromDb, { method: 'HEAD' });
            if (testResponse.ok) {
              setPdfUrl(pdfUrlFromDb);
              console.log('✅ PDF recuperado de Base de Datos:', pdfUrlFromDb.substring(0, 80));
              pdfLoaded = true;
            } else {
              console.warn('⚠️ URL existe pero no es accesible. Status:', testResponse.status);
              console.warn('   Intentando cargar de todas formas...');
              // Intentar cargar de todas formas por si el HEAD falla pero GET funciona
              setPdfUrl(pdfUrlFromDb);
              pdfLoaded = true;
            }
          } catch (blobError) {
            console.error('❌ Error verificando URL:', blobError);
            console.warn('   Intentando cargar de todas formas...');
            // Intentar cargar de todas formas
            setPdfUrl(pdfUrlFromDb);
            pdfLoaded = true;
          }
        } else {
          console.warn('⚠️ No hay URL de PDF en Base de Datos (ni pdf_blob_url ni file_url)');
        }

        // 2. Si falla, intentar desde sessionStorage
        if (!pdfLoaded) {
          const pdfData = sessionStorage.getItem(pdfKey);
          console.log('🔍 Intentando recuperar PDF de sessionStorage...');
          console.log('🔍 PDF data encontrado:', pdfData ? `Sí (${pdfData.length} chars)` : 'No');

          if (pdfData) {
            try {
              console.log('🔄 Convirtiendo base64 de sessionStorage a Blob...');
              const base64Content = pdfData.split(',')[1] || pdfData;
              const byteCharacters = atob(base64Content.replace(/\s/g, ''));
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);

              setPdfUrl(url);
              console.log('✅ PDF recuperado de sessionStorage:', url);
              pdfLoaded = true;
            } catch (e) {
              console.error('❌ Error decodificando sessionStorage:', e);
            }
          }
        }

        // 3. Si todo falla, mostrar advertencia
        if (!pdfLoaded) {
          console.error('❌ No se pudo recuperar el PDF de ninguna fuente');
          console.warn('⚠️ El visor de PDF no estará disponible para este documento');
        }
      } catch (error) {
        console.error('Error al cargar extracción:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Cleanup: revocar URL cuando el componente se desmonte
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [id]);

  // Handlers de navegación entre errores
  const handlePreviousError = () => {
    setCurrentErrorIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextError = () => {
    setCurrentErrorIndex(prev => Math.min(errors.length - 1, prev + 1));
  };

  // Abrir modal de corrección
  const handleStartEdit = (error: ApiValidationError) => {
    setEditingError(error);
    setCorrectedValue(error.extracted_value || '');
    setCorrectionNotes('');
    setIsEditModalOpen(true);
  };

  // Corregir error
  const handleFixError = async () => {
    if (!editingError) return;

    try {
      setProcessing(true);
      await fixValidationError(editingError.id, correctedValue, correctionNotes);

      // Actualizar lista de errores local
      setErrors(prev => prev.filter(e => e.id !== editingError.id));
      setIsEditModalOpen(false);
      setEditingError(null);
      setCorrectedValue('');
      setCorrectionNotes('');

      console.log('✅ Error corregido');

      // Si no quedan errores, redirigir a la lista
      if (errors.length <= 1) {
        alert('✅ Todos los errores han sido corregidos. Puedes aprobar el formulario.');
      }
    } catch (error) {
      console.error('Error al corregir:', error);
      alert('Error al guardar la corrección. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  // Ignorar error
  const handleIgnoreError = async (errorId: string) => {
    if (!confirm('¿Estás seguro de que quieres ignorar este error?')) return;

    try {
      setProcessing(true);
      await ignoreValidationError(errorId, 'Ignorado por el revisor');

      // Actualizar lista local
      setErrors(prev => prev.filter(e => e.id !== errorId));

      console.log('✅ Error ignorado');

      if (errors.length <= 1) {
        alert('✅ Todos los errores han sido procesados.');
      }
    } catch (error) {
      console.error('Error al ignorar:', error);
      alert('Error al ignorar el error. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };


  // Aprobar formulario completo
  const handleApprove = async () => {
    if (errors.length > 0) {
      if (!confirm(`Aún hay ${errors.length} errores pendientes. ¿Aprobar de todas formas?`)) {
        return;
      }
    }

    try {
      setProcessing(true);

      // 1. Aprobar la extracción en la BD
      await approveExtraction(id!, 'Aprobado por el revisor');

      // 2. 🔥 CORREGIDO: Añadir al Excel Master con mejor manejo de errores
      if (extraction) {
        console.log('📤 Añadiendo al Excel Master después de aprobar...');
        try {
          const response = await fetch('/api/master-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              extraction_id: extraction.id,
              row_data: extraction.extracted_data,
              filename: extraction.filename,
              validation_status: 'approved',
              cross_validation_match: true,
              discrepancy_count: 0
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));

            // Si ya existe, no es un error crítico
            if (response.status === 409) {
              console.log('ℹ️ El formulario ya existe en el Excel Master');
              alert('✅ Formulario aprobado (ya existía en Excel Master)');
            } else {
              console.error('❌ Error al añadir al Excel Master:', errorData);
              alert('⚠️ Formulario aprobado, pero hubo un problema al añadirlo al Excel Master. Por favor, verifica manualmente o contacta al administrador.');
            }
          } else {
            const result = await response.json();
            console.log('✅ Añadido al Excel Master con éxito:', result.id);
            alert('✅ Formulario aprobado y añadido al Excel Master correctamente');
          }
        } catch (masterExcelError) {
          console.error('❌ Error crítico al añadir al Excel Master:', masterExcelError);
          alert('⚠️ Formulario aprobado, pero falló la conexión al Excel Master. Verifica tu conexión o contacta al administrador.');
        }
      }

      navigate('/review');
    } catch (error) {
      console.error('Error al aprobar:', error);
      alert('Error al aprobar el formulario. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  // Rechazar formulario completo
  const handleReject = async () => {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;

    try {
      setProcessing(true);
      await rejectExtraction(id!, reason);
      alert('❌ Formulario rechazado');
      navigate('/review');
    } catch (error) {
      console.error('Error al rechazar:', error);
      alert('Error al rechazar. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  // 🔥 NUEVO: Anular documento → No procesable
  const handleAnular = async () => {
    if (!confirm('¿Anular este documento como NO PROCESABLE? No se guardará en el Excel Master.')) {
      return;
    }

    const reason = prompt('Motivo de anulación (opcional):') || 'Anulado manualmente en revisión';

    try {
      setProcessing(true);

      // 1. Registrar en unprocessable_documents
      await fetch('/api/unprocessable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: extraction?.filename,
          category: 'manual_anulado',
          reason,
          extractedData: extraction?.extracted_data,
          numero_expediente: extraction?.extracted_data?.numero_expediente,
          numero_accion: extraction?.extracted_data?.numero_accion,
          numero_grupo: extraction?.extracted_data?.numero_grupo
        })
      });

      // 2. Marcar extracción como rechazada
      await rejectExtraction(id!, reason);

      alert('🗑️ Documento anulado y marcado como NO PROCESABLE');
      navigate('/review');

    } catch (error) {
      console.error('Error al anular:', error);
      alert('Error al anular documento. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  // 🔥 CORREGIDO: Corregir y procesar → Enviar a Excel Master
  const handleCorregirYProcesar = async () => {
    if (!confirm('¿Corregir y enviar al Excel Master? Los datos actuales (con correcciones) se guardarán definitivamente.')) {
      return;
    }

    try {
      setProcessing(true);

      if (!extraction) {
        throw new Error('No hay datos de extracción');
      }

      // 1. Aprobar la extracción (esto ya actualiza validation_status)
      await approveExtraction(id!, 'Corregido y aprobado por revisor');

      // 2. 🔥 CORREGIDO: Agregar al Excel Master con mejor manejo de errores
      try {
        const response = await fetch('/api/master-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            extraction_id: extraction.id,
            row_data: extraction.extracted_data,
            filename: extraction.filename,
            validation_status: 'approved',
            cross_validation_match: true,
            discrepancy_count: 0
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));

          // Si ya existe (409), no es crítico
          if (response.status === 409) {
            console.log('ℹ️ El formulario ya existe en el Excel Master');
            alert('✅ Formulario corregido y aprobado (ya existía en Excel Master)');
          } else {
            console.error('❌ Error al añadir al Excel Master:', errorData);
            throw new Error(errorData.message || errorData.error || 'Error desconocido al añadir al Excel Master');
          }
        } else {
          const result = await response.json();
          console.log('✅ Añadido al Excel Master con éxito:', result.id);
          alert('✅ Formulario corregido y añadido al Excel Master correctamente');
        }
      } catch (masterExcelError: any) {
        console.error('❌ Error crítico al añadir al Excel Master:', masterExcelError);
        throw new Error(`Error al añadir al Excel Master: ${masterExcelError.message}`);
      }

      navigate('/master-excel'); // Redirigir a la vista del Excel Master

    } catch (error: any) {
      console.error('Error al corregir y procesar:', error);
      alert(`❌ Error: ${error.message}. Por favor, intenta de nuevo o contacta al administrador.`);
    } finally {
      setProcessing(false);
    }
  };

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditModalOpen || inlineEditField) return; // No interferir con edición

      if (e.key === 'ArrowLeft') {
        handlePreviousError();
      } else if (e.key === 'ArrowRight') {
        handleNextError();
      } else if (e.key === 'Escape') {
        navigate('/review');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, inlineEditField, currentErrorIndex, errors.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (!extraction) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Formulario no encontrado</p>
          <button
            onClick={() => navigate('/review')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  const currentError = errors[currentErrorIndex];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/review')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Volver
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {extraction.filename}
              </h1>
              <p className="text-sm text-gray-500">
                Procesado: {new Date(extraction.created_at).toLocaleString('es-ES')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Contador de errores */}
            <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-sm font-medium text-amber-800">
                {errors.length} {errors.length === 1 ? 'error' : 'errores'} pendiente{errors.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Botones de acción */}
            <button
              onClick={handleAnular}
              disabled={processing}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Anular documento como NO PROCESABLE"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Anular
            </button>

            <button
              onClick={handleCorregirYProcesar}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Corregir y enviar al Excel Master"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Corregir y Procesar
            </button>

            <button
              onClick={handleReject}
              disabled={processing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Rechazar
            </button>
            <button
              onClick={handleApprove}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aprobar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Layout de 2 columnas (60/40) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Columna izquierda: Visor PDF (60%) */}
        <div className="w-3/5 h-full bg-gray-200 border-r border-gray-300 relative overflow-hidden flex flex-col items-center justify-center">
          {pdfUrl ? (
            <PdfViewerOptimized
              pdfUrl={pdfUrl}
              highlights={pdfHighlights}
              currentErrorId={currentError?.id || null}
              onHighlightClick={handleHighlightClick}
              className="w-full h-full"
            />
          ) : (
            <div className="text-center p-8">
              <div className="text-red-500 text-5xl mb-4">📄❌</div>
              <h2 className="text-xl font-bold mb-2">Visor PDF No Disponible</h2>
              <p className="text-gray-600 max-w-sm">
                No se pudo recuperar el archivo original. Esto puede deberse a un error en la subida inicial.
                Puedes seguir corrigiendo los datos a la derecha.
              </p>
            </div>
          )}
        </div>

        {/* Columna derecha: Panel de errores y datos (40%) */}
        <div className="w-2/5 h-full bg-white flex flex-col shadow-inner overflow-auto">
          {errors.length === 0 ? (
            // Sin errores - pero verificar si viene de No Procesables
            <div className="flex-1 flex items-center justify-center p-6">
              {extraction.model_used === 'manual_transfer' || extraction.rejection_reason ? (
                // Documento que viene de No Procesables - mostrar advertencia
                <div className="text-center max-w-lg">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h2 className="text-2xl font-semibold text-orange-800 mb-2">
                    Documento de No Procesables
                  </h2>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm font-medium text-orange-800 mb-2">Motivo del rechazo original:</p>
                    <p className="text-orange-700">
                      {extraction.rejection_reason || 'Sin motivo especificado'}
                    </p>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Este documento fue rechazado automáticamente. Revisa los datos extraídos
                    antes de decidir si aprobarlo o rechazarlo definitivamente.
                  </p>

                  {/* Mostrar TODOS los datos extraídos con opción de editar */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6 text-left max-h-96 overflow-auto">
                    <p className="text-sm font-medium text-gray-700 mb-2">Todos los datos extraídos ({extraction.extracted_data ? Object.keys(extraction.extracted_data).length : 0} campos):</p>
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="py-2 px-1 text-center text-xs font-medium text-gray-500 uppercase w-10"></th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase">Campo</th>
                          <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraction.extracted_data && Object.entries(extraction.extracted_data).map(([key, value]) => (
                          <tr key={key} className="border-b border-gray-100 hover:bg-gray-100">
                            <td className="py-1 px-1 text-center">
                              <button
                                onClick={() => handleStartInlineEdit(key, value)}
                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                title="Editar campo"
                              >
                                ✏️
                              </button>
                            </td>
                            <td className="py-1 px-2 font-mono text-gray-500 text-xs">{key}</td>
                            <td className="py-1 px-2 text-gray-900">{renderValueCell(key, value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleReject}
                      disabled={processing}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Rechazar Definitivamente
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Aprobar de Todas Formas
                    </button>
                  </div>
                </div>
              ) : (
                // Documento normal sin errores - mostrar banner + tabla editable
                <div className="flex-1 flex flex-col p-4 overflow-auto">
                  {/* Banner compacto verde */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <span className="text-green-600 text-lg">✅</span>
                    <span className="text-green-800 font-medium text-sm">Sin errores pendientes — Revisa los campos antes de aprobar</span>
                  </div>

                  {/* Tabla completa de campos editables */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex-1">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12"></th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Campo</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {extraction && extraction.extracted_data && Object.entries(extraction.extracted_data).map(([key, value]) => (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => handleStartFieldEdit(key, value)}
                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                title="Editar campo"
                              >
                                ✏️
                              </button>
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-gray-500">{key}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{String(value ?? '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Botón aprobar al final */}
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      Aprobar Formulario
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Header del panel de errores */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Errores de Validación
                  </h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handlePreviousError}
                      disabled={currentErrorIndex === 0}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Error anterior (←)"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm text-gray-600">
                      {currentErrorIndex + 1} / {errors.length}
                    </span>
                    <button
                      onClick={handleNextError}
                      disabled={currentErrorIndex === errors.length - 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Error siguiente (→)"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-500">
                  Usa las flechas del teclado (← →) para navegar entre errores
                </p>
              </div>

              {/* Contenido del error actual */}
              {currentError && (
                <div className="flex-1 overflow-auto p-6">
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 mb-6">
                    {/* Tipo de error */}
                    <div className="flex items-start mb-4">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-lg font-medium text-red-800">
                          {currentError.error_type}
                        </h3>
                        <p className="mt-1 text-sm text-red-700">
                          {currentError.error_message}
                        </p>
                      </div>
                    </div>

                    {/* Información del campo */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-red-800 uppercase">Campo:</span>
                        <p className="mt-1 text-sm text-gray-900 font-medium">
                          {currentError.field_name}
                        </p>
                      </div>

                      <div>
                        <span className="text-xs font-medium text-red-800 uppercase">Valor extraído:</span>
                        <p className="mt-1 text-sm text-gray-900 bg-white px-3 py-2 rounded border border-red-200">
                          {currentError.extracted_value || '(vacío)'}
                        </p>
                      </div>

                      {currentError.expected_format && (
                        <div>
                          <span className="text-xs font-medium text-red-800 uppercase">Formato esperado:</span>
                          <p className="mt-1 text-sm text-gray-600">
                            {currentError.expected_format}
                          </p>
                        </div>
                      )}

                      <div>
                        <span className="text-xs font-medium text-red-800 uppercase">Severidad:</span>
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          currentError.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          currentError.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          currentError.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {currentError.severity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="space-y-3">
                    <button
                      onClick={() => handleStartEdit(currentError)}
                      disabled={processing}
                      className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Corregir Error
                    </button>

                    {currentError.severity !== 'critical' && (
                      <button
                        onClick={() => handleIgnoreError(currentError.id)}
                        disabled={processing}
                        className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium flex items-center justify-center"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        Ignorar (No crítico)
                      </button>
                    )}
                  </div>

                  {/* Sección de Contexto: Datos Extraídos */}
                  <div className="mt-10 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                      Todos los Datos Extraídos
                    </h3>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12"></th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Campo</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {extraction && extraction.extracted_data && Object.entries(extraction.extracted_data).map(([key, value]) => (
                            <tr key={key} className={currentError?.field_name === key ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                              <td className="px-2 py-2 text-center">
                                <button
                                  onClick={() => handleStartInlineEdit(key, value)}
                                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                  title="Editar campo"
                                >
                                  ✏️
                                </button>
                              </td>
                              <td className="px-4 py-2 text-xs font-mono text-gray-500">{key}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{renderValueCell(key, value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Lista de errores restantes */}
                  {errors.length > 1 && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Otros errores ({errors.length - 1})
                      </h3>
                      <div className="space-y-2">
                        {errors.map((error, index) => {
                          if (index === currentErrorIndex) return null;
                          return (
                            <button
                              key={error.id}
                              onClick={() => setCurrentErrorIndex(index)}
                              className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm"
                            >
                              <div className="font-medium text-gray-900">{error.field_name}</div>
                              <div className="text-gray-600 truncate">{error.error_message}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de corrección */}
      {isEditModalOpen && editingError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Corregir Error
                </h2>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Campo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campo
                </label>
                <p className="text-gray-900 font-medium">{editingError.field_name}</p>
              </div>

              {/* Valor original */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor original (extraído)
                </label>
                <p className="text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                  {editingError.extracted_value || '(vacío)'}
                </p>
              </div>

              {/* Valor corregido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor corregido *
                </label>
                <input
                  type="text"
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ingresa el valor correcto"
                  autoFocus
                />
              </div>

              {/* Notas opcionales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Agrega notas sobre la corrección..."
                />
              </div>

              {/* Error info */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>Error:</strong> {editingError.error_message}
                </p>
                {editingError.expected_format && (
                  <p className="text-sm text-red-700 mt-1">
                    <strong>Formato esperado:</strong> {editingError.expected_format}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={processing}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleFixError}
                disabled={processing || !correctedValue.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Guardando...' : 'Guardar Corrección'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
