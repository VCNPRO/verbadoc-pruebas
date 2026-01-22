/**
 * ColumnMappingEditor.tsx
 *
 * Editor de mapeo de columnas entre campos FUNDAE y columnas Excel de salida
 * Permite configurar cómo se exportarán los datos extraídos al Excel final
 */

import React, { useState, useEffect } from 'react';

// ============================================================================
// TIPOS
// ============================================================================

export interface ColumnMapping {
  fundaeField: string;           // Campo del formulario FUNDAE
  excelColumn: string;            // Columna destino en Excel (A, B, C...)
  excelColumnName: string;        // Nombre de columna (para referencia)
  required: boolean;              // Si es campo obligatorio
  transform?: TransformType;      // Transformación opcional
  section?: 'header' | 'seccion_i' | 'seccion_ii' | 'valoraciones';
}

type TransformType = 'none' | 'uppercase' | 'lowercase' | 'date_format' | 'city_code_expand';

// ============================================================================
// MAPEOS POR DEFECTO FUNDAE
// ============================================================================

const DEFAULT_FUNDAE_MAPPINGS: Omit<ColumnMapping, 'excelColumn' | 'excelColumnName'>[] = [
  // SECCIÓN I: Datos identificativos
  { fundaeField: 'expediente', required: true, section: 'seccion_i' },
  { fundaeField: 'empresa', required: false, section: 'seccion_i' },
  { fundaeField: 'modalidad', required: false, section: 'seccion_i' },
  { fundaeField: 'cif', required: true, transform: 'uppercase', section: 'seccion_i' },
  { fundaeField: 'denominacion_aaff', required: true, section: 'seccion_i' },

  // SECCIÓN II: Datos del participante
  { fundaeField: 'edad', required: true, section: 'seccion_ii' },
  { fundaeField: 'sexo', required: true, section: 'seccion_ii' },
  { fundaeField: 'titulacion', required: true, section: 'seccion_ii' },
  { fundaeField: 'lugar_trabajo', required: true, transform: 'city_code_expand', section: 'seccion_ii' },
  { fundaeField: 'categoria_profesional', required: true, section: 'seccion_ii' },
  { fundaeField: 'tamano_empresa', required: false, section: 'seccion_ii' },
  { fundaeField: 'antiguedad', required: false, section: 'seccion_ii' },
  { fundaeField: 'situacion_laboral', required: false, section: 'seccion_ii' },
  { fundaeField: 'nivel_estudios', required: false, section: 'seccion_ii' },

  // SECCIÓN III: Valoraciones (resumen)
  { fundaeField: 'valoracion_promedio', required: false, section: 'valoraciones' },
  { fundaeField: 'satisfaccion_general', required: false, section: 'valoraciones' },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ColumnMappingEditor() {
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [excelColumnNames, setExcelColumnNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filterSection, setFilterSection] = useState<string>('all');

  useEffect(() => {
    loadConfiguration();
  }, []);

  /**
   * Cargar configuración guardada o crear por defecto
   */
  const loadConfiguration = () => {
    try {
      setLoading(true);
      setError('');

      // Cargar plantilla de Excel (columnas disponibles)
      const templateConfig = localStorage.getItem('excel_template_config');
      if (!templateConfig) {
        setError('Primero debes cargar el Excel de plantilla en "Gestión de Excel"');
        setLoading(false);
        return;
      }

      const template = JSON.parse(templateConfig);
      const columns = template.columns as string[];

      // Generar letras de columnas (A, B, C, ...)
      const columnLetters = columns.map((_, idx) => getColumnLetter(idx));
      setExcelColumns(columnLetters);

      // Crear mapa de columnas
      const columnNamesMap: Record<string, string> = {};
      columns.forEach((name, idx) => {
        columnNamesMap[columnLetters[idx]] = name;
      });
      setExcelColumnNames(columnNamesMap);

      // Cargar mapeo guardado o crear por defecto
      const savedMapping = localStorage.getItem('column_mapping');
      if (savedMapping) {
        const parsed = JSON.parse(savedMapping);
        setMappings(parsed);
        console.log('✅ Mapeo cargado desde localStorage:', parsed.length, 'campos');
      } else {
        // Crear mapeo por defecto automático
        const defaultMappings = createDefaultMappings(columns, columnLetters);
        setMappings(defaultMappings);
        console.log('✅ Mapeo por defecto creado:', defaultMappings.length, 'campos');
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error al cargar configuración:', error);
      setError(`Error al cargar: ${error.message}`);
      setLoading(false);
    }
  };

  /**
   * Crear mapeo por defecto intentando match automático
   */
  const createDefaultMappings = (excelColumns: string[], columnLetters: string[]): ColumnMapping[] => {
    return DEFAULT_FUNDAE_MAPPINGS.map(field => {
      // Intentar encontrar columna que coincida
      const matchIdx = excelColumns.findIndex(col =>
        col.toLowerCase().includes(field.fundaeField.toLowerCase().replace('_', ' ')) ||
        field.fundaeField.toLowerCase().includes(col.toLowerCase().replace(' ', '_'))
      );

      const excelColumn = matchIdx >= 0 ? columnLetters[matchIdx] : columnLetters[0] || 'A';
      const excelColumnName = matchIdx >= 0 ? excelColumns[matchIdx] : excelColumns[0] || 'Sin asignar';

      return {
        ...field,
        excelColumn,
        excelColumnName,
        transform: field.transform || 'none'
      };
    });
  };

  /**
   * Actualizar un mapeo específico
   */
  const updateMapping = (index: number, field: keyof ColumnMapping, value: any) => {
    setMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Si se cambió la columna Excel, actualizar también el nombre
      if (field === 'excelColumn') {
        updated[index].excelColumnName = excelColumnNames[value] || value;
      }

      return updated;
    });
  };

  /**
   * Agregar nuevo campo personalizado
   */
  const addCustomField = () => {
    const newField: ColumnMapping = {
      fundaeField: 'campo_personalizado',
      excelColumn: excelColumns[0] || 'A',
      excelColumnName: excelColumnNames[excelColumns[0]] || 'Sin asignar',
      required: false,
      transform: 'none'
    };

    setMappings(prev => [...prev, newField]);
  };

  /**
   * Eliminar campo
   */
  const removeField = (index: number) => {
    if (mappings[index].required) {
      alert('No se puede eliminar un campo obligatorio');
      return;
    }

    setMappings(prev => prev.filter((_, idx) => idx !== index));
  };

  /**
   * Guardar configuración
   */
  const saveMappings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      // Validar que no haya duplicados en columnas Excel
      const usedColumns = new Set<string>();
      for (const mapping of mappings) {
        if (usedColumns.has(mapping.excelColumn)) {
          throw new Error(`La columna ${mapping.excelColumn} está asignada a múltiples campos`);
        }
        usedColumns.add(mapping.excelColumn);
      }

      // Validar que todos los campos obligatorios estén mapeados
      const requiredFields = mappings.filter(m => m.required);
      for (const field of requiredFields) {
        if (!field.excelColumn) {
          throw new Error(`El campo obligatorio "${field.fundaeField}" debe tener una columna asignada`);
        }
      }

      // Guardar en localStorage
      localStorage.setItem('column_mapping', JSON.stringify(mappings));

      // Guardar en BD también (si hay endpoint)
      try {
        const response = await fetch('/api/column-mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            mapping_name: 'Configuración FUNDAE Principal',
            description: 'Mapeo de columnas para formularios FUNDAE',
            mappings: mappings,
            is_active: true
          })
        });

        if (!response.ok) {
          throw new Error('No se pudo guardar en BD, Error al guardar configuración en base de datos');
        }
      } catch (apiError) {
        throw new Error('No se pudo guardar la configuración en la base de datos');
      }

      setSuccessMessage('✅ Mapeo guardado exitosamente');
      console.log('✅ Mapeo guardado:', mappings.length, 'campos');

      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error: any) {
      console.error('Error al guardar mapeo:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Resetear a mapeo por defecto
   */
  const resetToDefault = () => {
    if (!confirm('¿Estás seguro de que quieres resetear el mapeo a los valores por defecto?')) {
      return;
    }

    const templateConfig = localStorage.getItem('excel_template_config');
    if (templateConfig) {
      const template = JSON.parse(templateConfig);
      const columnLetters = template.columns.map((_: any, idx: number) => getColumnLetter(idx));
      const defaultMappings = createDefaultMappings(template.columns, columnLetters);
      setMappings(defaultMappings);
      setSuccessMessage('Mapeo reseteado a valores por defecto');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // Filtrar mappings según sección seleccionada
  const filteredMappings = filterSection === 'all'
    ? mappings
    : mappings.filter(m => m.section === filterSection);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (error && !mappings.length) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-red-400">{error}</p>
            <a
              href="/admin/excel-management"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded"
            >
              Ir a Gestión de Excel
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Editor de Mapeo de Columnas</h1>
          <p className="text-gray-400">
            Asigna cada campo del formulario FUNDAE a una columna del Excel de salida
          </p>
        </div>

        {/* Mensajes */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-900/30 border border-green-700 rounded">
            <p className="text-green-400">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Controles */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* Filtro por sección */}
          <div>
            <label className="text-sm text-gray-400 mr-2">Filtrar por sección:</label>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              <option value="all">Todas las secciones</option>
              <option value="seccion_i">Sección I: Identificativos</option>
              <option value="seccion_ii">Sección II: Participante</option>
              <option value="valoraciones">Sección III: Valoraciones</option>
            </select>
          </div>

          {/* Acciones */}
          <div className="ml-auto flex gap-2">
            <button
              onClick={addCustomField}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              + Agregar Campo
            </button>
            <button
              onClick={resetToDefault}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Resetear
            </button>
            <button
              onClick={saveMappings}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-medium disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Mapeo'}
            </button>
          </div>
        </div>

        {/* Tabla de mapeo */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Campo FUNDAE</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Sección</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Columna Excel</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Nombre Columna</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Transformación</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Obligatorio</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.map((mapping, idx) => {
                  const originalIdx = mappings.findIndex(m => m === mapping);
                  return (
                    <tr key={originalIdx} className="border-t border-gray-700 hover:bg-gray-750">
                      {/* Campo FUNDAE */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={mapping.fundaeField}
                          onChange={(e) => updateMapping(originalIdx, 'fundaeField', e.target.value)}
                          className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
                        />
                      </td>

                      {/* Sección */}
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                          {mapping.section || 'custom'}
                        </span>
                      </td>

                      {/* Columna Excel */}
                      <td className="px-4 py-3">
                        <select
                          value={mapping.excelColumn}
                          onChange={(e) => updateMapping(originalIdx, 'excelColumn', e.target.value)}
                          className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
                        >
                          {excelColumns.map(col => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Nombre Columna */}
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {mapping.excelColumnName}
                      </td>

                      {/* Transformación */}
                      <td className="px-4 py-3">
                        <select
                          value={mapping.transform || 'none'}
                          onChange={(e) => updateMapping(originalIdx, 'transform', e.target.value)}
                          className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
                        >
                          <option value="none">Ninguna</option>
                          <option value="uppercase">Mayúsculas</option>
                          <option value="lowercase">Minúsculas</option>
                          <option value="date_format">Formato fecha</option>
                          <option value="city_code_expand">Expandir código ciudad</option>
                        </select>
                      </td>

                      {/* Obligatorio */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={mapping.required}
                          onChange={(e) => updateMapping(originalIdx, 'required', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 text-center">
                        {!mapping.required && (
                          <button
                            onClick={() => removeField(originalIdx)}
                            className="text-red-400 hover:text-red-300 text-sm"
                            title="Eliminar campo"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-1">Total Campos</h3>
            <p className="text-2xl font-bold">{mappings.length}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-1">Campos Obligatorios</h3>
            <p className="text-2xl font-bold text-yellow-400">
              {mappings.filter(m => m.required).length}
            </p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-1">Columnas Excel Usadas</h3>
            <p className="text-2xl font-bold text-green-400">
              {new Set(mappings.map(m => m.excelColumn)).size} / {excelColumns.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Convierte índice numérico a letra de columna Excel (0 → A, 1 → B, ..., 26 → AA)
 */
function getColumnLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/**
 * Exportar configuración de mapeo (para uso en servicios de exportación)
 */
export function getColumnMappingConfig(): ColumnMapping[] {
  const saved = localStorage.getItem('column_mapping');
  if (!saved) {
    return [];
  }
  return JSON.parse(saved);
}
