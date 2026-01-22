/**
 * ExcelManagementPanel.tsx
 *
 * Panel de administración para cargar y gestionar los 3 archivos Excel del cliente:
 * 1. Excel de Validación: Datos oficiales (expediente, CIF, razón social) para validación cruzada
 * 2. Excel Plantilla de Salida: Columnas destino donde se volcarán los datos extraídos
 * 3. Catálogo de Códigos de Ciudades: Mapeo de códigos (BCN, MAD) a nombres completos
 */

import React, { useState, useEffect } from 'react';
import { getExcelPreview, validateExcelStructure } from '@/services/excelParserService';
import { loadCityCodesFromExcel, saveCityCodesCatalog } from '@/data/cityCodes';

// ============================================================================
// TIPOS
// ============================================================================

type ExcelFileType = 'validation' | 'template' | 'cities';
type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface ExcelFile {
  type: ExcelFileType;
  file: File | null;
  status: FileStatus;
  previewData?: any[];
  columnsFound?: string[];
  error?: string;
  uploadedAt?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ExcelManagementPanel() {
  const [files, setFiles] = useState<Record<ExcelFileType, ExcelFile>>({
    validation: { type: 'validation', file: null, status: 'pending' },
    template: { type: 'template', file: null, status: 'pending' },
    cities: { type: 'cities', file: null, status: 'pending' }
  });

  // Cargar estado guardado de localStorage
  useEffect(() => {
    loadSavedState();
  }, []);

  /**
   * Cargar estado de archivos previamente subidos
   */
  const loadSavedState = () => {
    const saved = localStorage.getItem('excel_management_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setFiles(prev => ({
          validation: { ...prev.validation, uploadedAt: state.validation?.uploadedAt, status: state.validation?.uploadedAt ? 'success' : 'pending' },
          template: { ...prev.template, uploadedAt: state.template?.uploadedAt, status: state.template?.uploadedAt ? 'success' : 'pending' },
          cities: { ...prev.cities, uploadedAt: state.cities?.uploadedAt, status: state.cities?.uploadedAt ? 'success' : 'pending' }
        }));
      } catch (error) {
        console.error('Error al cargar estado guardado:', error);
      }
    }
  };

  /**
   * Guardar estado en localStorage
   */
  const saveState = (type: ExcelFileType, uploadedAt?: string) => {
    const saved = localStorage.getItem('excel_management_state');
    const state = saved ? JSON.parse(saved) : {};
    state[type] = { uploadedAt };
    localStorage.setItem('excel_management_state', JSON.stringify(state));
  };

  /**
   * Manejar selección de archivo
   */
  const handleFileSelect = async (type: ExcelFileType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log(`📂 Archivo seleccionado (${type}):`, file.name);

    // Validar que sea un archivo Excel
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setFiles(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          file: null,
          status: 'error',
          error: 'El archivo debe ser Excel (.xlsx o .xls)'
        }
      }));
      return;
    }

    setFiles(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        file,
        status: 'pending',
        error: undefined,
        previewData: undefined,
        columnsFound: undefined
      }
    }));

    // Previsualizar datos
    try {
      const buffer = await file.arrayBuffer();
      // Ya tenemos ArrayBuffer, NO necesitamos Buffer.from() (solo funciona en Node.js)

      // Validar estructura según tipo de Excel
      let validation: { valid: boolean; error?: string; columnsFound?: string[] } = { valid: true };

      if (type === 'validation') {
        // Excel de validación: debe tener columnas de expediente/CIF/razón social
        validation = validateExcelStructure(buffer, ['expediente', 'cif']);
        if (!validation.valid) {
          setFiles(prev => ({
            ...prev,
            [type]: {
              ...prev[type],
              status: 'error',
              error: validation.error
            }
          }));
          return;
        }
      } else if (type === 'cities') {
        // Excel de ciudades: validación simple (solo que tenga datos, sin verificar identificador)
        validation = validateExcelStructure(buffer, [], { skipIdentifierCheck: true });
        if (!validation.valid) {
          setFiles(prev => ({
            ...prev,
            [type]: {
              ...prev[type],
              status: 'error',
              error: validation.error
            }
          }));
          return;
        }
      } else if (type === 'template') {
        // Template: validación sin identificadores requeridos
        validation = validateExcelStructure(buffer, [], { skipIdentifierCheck: true });
      }

      // Obtener preview
      const preview = getExcelPreview(buffer, 5);
      if (!preview.success) {
        throw new Error(preview.error || 'Error al previsualizar');
      }

      setFiles(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          previewData: preview.preview,
          columnsFound: validation.columnsFound,
          status: 'pending'
        }
      }));

      console.log(`✅ Preview cargado para ${type}:`, preview.preview?.length, 'filas');

    } catch (error: any) {
      console.error('Error al previsualizar:', error);
      setFiles(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          status: 'error',
          error: `Error al previsualizar: ${error.message}`
        }
      }));
    }
  };

  /**
   * Subir archivo Excel
   */
  const handleUpload = async (type: ExcelFileType) => {
    const fileData = files[type];
    if (!fileData.file) {
      alert('Por favor selecciona un archivo primero');
      return;
    }

    console.log(`🚀 Iniciando subida de ${type}...`);

    setFiles(prev => ({
      ...prev,
      [type]: { ...prev[type], status: 'uploading', error: undefined }
    }));

    try {
      if (type === 'validation') {
        // Subir Excel de validación cruzada (usa FormData)
        await uploadValidationExcel(fileData.file);
        console.log('✅ Excel de validación subido exitosamente');

      } else {
        // Para template y cities, aún usamos ArrayBuffer
        const buffer = await fileData.file.arrayBuffer();

        if (type === 'template') {
          // Guardar plantilla de salida en localStorage
          await saveTemplateConfig(buffer, fileData.file.name);
          console.log('✅ Plantilla de salida guardada exitosamente');

        } else if (type === 'cities') {
          // Cargar y guardar catálogo de ciudades
          const codes = await loadCityCodesFromExcel(buffer);
          saveCityCodesCatalog(codes);
          console.log(`✅ Catálogo de ciudades guardado: ${Object.keys(codes).length} códigos`);
        }
      }

      const uploadedAt = new Date().toISOString();
      setFiles(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          status: 'success',
          uploadedAt
        }
      }));

      saveState(type, uploadedAt);

    } catch (error: any) {
      console.error(`❌ Error al subir ${type}:`, error);
      setFiles(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          status: 'error',
          error: `Error al subir: ${error.message}`
        }
      }));
    }
  };

  /**
   * Eliminar archivo cargado
   */
  const handleRemove = (type: ExcelFileType) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) {
      return;
    }

    setFiles(prev => ({
      ...prev,
      [type]: {
        type,
        file: null,
        status: 'pending',
        previewData: undefined,
        columnsFound: undefined,
        error: undefined,
        uploadedAt: undefined
      }
    }));

    saveState(type, undefined);

    // Limpiar localStorage según tipo
    if (type === 'cities') {
      localStorage.removeItem('city_codes_catalog');
      localStorage.removeItem('city_codes_catalog_timestamp');
    } else if (type === 'template') {
      localStorage.removeItem('excel_template_config');
    }

    console.log(`🗑️ Archivo ${type} eliminado`);
  };

  return (
    <div className="p-6 space-y-8 bg-gray-900 text-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestión de Archivos Excel</h1>
        <p className="text-gray-400">
          Carga los 3 archivos Excel del cliente para configurar el sistema de validación y exportación
        </p>
      </div>

      {/* Excel 1: Validación Cruzada */}
      <ExcelCard
        title="1. Excel de Validación (Datos Oficiales)"
        description="Excel maestro con expedientes, CIF, razón social para validación cruzada con formularios FUNDAE"
        requiredColumns={['expediente', 'cif', 'razon social']}
        fileData={files.validation}
        onFileSelect={(e) => handleFileSelect('validation', e)}
        onUpload={() => handleUpload('validation')}
        onRemove={() => handleRemove('validation')}
      />

      {/* Excel 2: Plantilla de Salida */}
      <ExcelCard
        title="2. Excel Plantilla de Salida"
        description="Excel con columnas destino donde se volcarán los datos extraídos de los formularios"
        requiredColumns={['expediente', 'cif', 'denominacion', 'edad', 'sexo']}
        fileData={files.template}
        onFileSelect={(e) => handleFileSelect('template', e)}
        onUpload={() => handleUpload('template')}
        onRemove={() => handleRemove('template')}
      />

      {/* Excel 3: Códigos de Ciudades */}
      <ExcelCard
        title="3. Catálogo de Códigos de Ciudades"
        description="Listado de códigos abreviados (BCN, MAD, VLC) con su correspondencia a nombres completos"
        requiredColumns={['codigo', 'ciudad']}
        fileData={files.cities}
        onFileSelect={(e) => handleFileSelect('cities', e)}
        onUpload={() => handleUpload('cities')}
        onRemove={() => handleRemove('cities')}
      />

      {/* Estado General */}
      <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Estado del Sistema</h3>
        <div className="space-y-2">
          <StatusItem
            label="Excel de Validación"
            status={files.validation.status}
            uploadedAt={files.validation.uploadedAt}
          />
          <StatusItem
            label="Plantilla de Salida"
            status={files.template.status}
            uploadedAt={files.template.uploadedAt}
          />
          <StatusItem
            label="Catálogo de Ciudades"
            status={files.cities.status}
            uploadedAt={files.cities.uploadedAt}
          />
        </div>

        {files.validation.status === 'success' &&
         files.template.status === 'success' &&
         files.cities.status === 'success' && (
          <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded">
            <p className="text-green-400 font-medium">
              ✅ Sistema configurado correctamente. Listo para procesar formularios FUNDAE.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTES
// ============================================================================

interface ExcelCardProps {
  title: string;
  description: string;
  requiredColumns: string[];
  fileData: ExcelFile;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onRemove: () => void;
}

function ExcelCard({
  title,
  description,
  requiredColumns,
  fileData,
  onFileSelect,
  onUpload,
  onRemove
}: ExcelCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>

      {/* Columnas requeridas */}
      <div>
        <p className="text-sm text-gray-400 mb-2">Columnas requeridas:</p>
        <div className="flex flex-wrap gap-2">
          {requiredColumns.map(col => (
            <span key={col} className="px-2 py-1 bg-gray-700 rounded text-xs">
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* Selector de archivo */}
      <div>
        <label className="block mb-2 text-sm font-medium">Seleccionar archivo Excel</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={onFileSelect}
          className="block w-full text-sm text-gray-400
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-indigo-600 file:text-white
            hover:file:bg-indigo-700
            file:cursor-pointer cursor-pointer"
        />
      </div>

      {/* Preview de datos */}
      {fileData.previewData && fileData.previewData.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Vista previa (primeras 5 filas):</p>
          <div className="overflow-x-auto bg-gray-900 rounded border border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-700">
                  {fileData.columnsFound?.slice(0, 6).map((col, idx) => (
                    <th key={idx} className="px-3 py-2 text-left">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fileData.previewData.slice(0, 3).map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-700">
                    {Object.values(row).slice(0, 6).map((val, colIdx) => (
                      <td key={colIdx} className="px-3 py-2 text-gray-300">
                        {String(val || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Columnas detectadas: {fileData.columnsFound?.length || 0}
          </p>
        </div>
      )}

      {/* Error */}
      {fileData.error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded">
          <p className="text-red-400 text-sm">{fileData.error}</p>
        </div>
      )}

      {/* Estado y acciones */}
      <div className="flex items-center gap-3 pt-2">
        {fileData.status === 'pending' && fileData.file && (
          <button
            onClick={onUpload}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-medium"
          >
            Subir y Guardar
          </button>
        )}

        {fileData.status === 'uploading' && (
          <div className="flex items-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
            <span className="text-sm">Subiendo...</span>
          </div>
        )}

        {fileData.status === 'success' && (
          <>
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Archivo cargado exitosamente</span>
            </div>
            <button
              onClick={onRemove}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface StatusItemProps {
  label: string;
  status: FileStatus;
  uploadedAt?: string;
}

function StatusItem({ label, status, uploadedAt }: StatusItemProps) {
  const statusConfig = {
    pending: { icon: '⏳', text: 'Pendiente', color: 'text-gray-400' },
    uploading: { icon: '⏰', text: 'Subiendo...', color: 'text-yellow-400' },
    success: { icon: '✅', text: 'Cargado', color: 'text-green-400' },
    error: { icon: '❌', text: 'Error', color: 'text-red-400' }
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${config.color}`}>
          {config.icon} {config.text}
        </span>
        {uploadedAt && (
          <span className="text-xs text-gray-500">
            ({new Date(uploadedAt).toLocaleDateString()})
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Subir Excel de validación a la base de datos
 */
async function uploadValidationExcel(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);

  const response = await fetch('/api/reference-data/upload', {
    method: 'POST',
    body: formData  // Sin Content-Type header, el navegador lo establece automáticamente
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Error del backend:', error);
    // Mostrar el mensaje más detallado posible
    throw new Error(error.message || error.details || error.error || 'Error al subir Excel de validación');
  }

  const result = await response.json();
  console.log('✅ Upload exitoso:', result);
}

/**
 * Guardar configuración de plantilla de salida
 */
async function saveTemplateConfig(buffer: ArrayBuffer, filename: string): Promise<void> {
  // Parsear columnas del Excel
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length === 0) {
    throw new Error('Excel de plantilla vacío');
  }

  const headers = data[0] as string[];

  const config = {
    filename,
    columns: headers,
    uploadedAt: new Date().toISOString()
  };

  localStorage.setItem('excel_template_config', JSON.stringify(config));
}
