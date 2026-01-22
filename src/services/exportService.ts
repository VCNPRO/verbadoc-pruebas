/**
 * Servicio de Exportación Consolidada
 *
 * Exporta múltiples extracciones a Excel, CSV o PDF consolidado
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sql } from '@vercel/postgres';

// ============================================================================
// TIPOS
// ============================================================================

export interface ExportOptions {
  extractionIds: string[];
  format: 'excel' | 'csv' | 'pdf';
  includeValidation?: boolean;
  includeCrossValidation?: boolean;
  groupBy?: 'date' | 'status' | 'user';
}

export interface ExportResult {
  success: boolean;
  buffer?: Buffer;
  filename?: string;
  mimeType?: string;
  error?: string;
}

// ============================================================================
// EXPORTAR A EXCEL
// ============================================================================

/**
 * Exportar extracciones a Excel
 */
export async function exportToExcel(options: ExportOptions): Promise<ExportResult> {
  try {
    const { extractionIds, includeValidation, includeCrossValidation } = options;

    // Obtener datos
    const extractions = await getExtractionsData(extractionIds);

    if (extractions.length === 0) {
      return {
        success: false,
        error: 'No se encontraron extracciones para exportar'
      };
    }

    // Crear workbook
    const workbook = XLSX.utils.book_new();

    // Hoja 1: Datos principales
    const mainData = extractions.map(ext => flattenExtraction(ext));
    const mainSheet = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'Extracciones');

    // Hoja 2: Validación (si se solicita)
    if (includeValidation && extractions.some(e => e.validation_errors)) {
      const validationData = extractValidationErrors(extractions);
      if (validationData.length > 0) {
        const validationSheet = XLSX.utils.json_to_sheet(validationData);
        XLSX.utils.book_append_sheet(workbook, validationSheet, 'Errores de Validación');
      }
    }

    // Hoja 3: Validación cruzada (si se solicita)
    if (includeCrossValidation) {
      const crossValData = await getCrossValidationData(extractionIds);
      if (crossValData.length > 0) {
        const crossValSheet = XLSX.utils.json_to_sheet(crossValData);
        XLSX.utils.book_append_sheet(workbook, crossValSheet, 'Validación Cruzada');
      }
    }

    // Generar buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `verbadocpro_export_${timestamp}.xlsx`;

    return {
      success: true,
      buffer: Buffer.from(buffer),
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error: any) {
    console.error('❌ Error al exportar a Excel:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// EXPORTAR A CSV
// ============================================================================

/**
 * Exportar extracciones a CSV
 */
export async function exportToCSV(options: ExportOptions): Promise<ExportResult> {
  try {
    const { extractionIds } = options;

    // Obtener datos
    const extractions = await getExtractionsData(extractionIds);

    if (extractions.length === 0) {
      return {
        success: false,
        error: 'No se encontraron extracciones para exportar'
      };
    }

    // Aplanar datos
    const flatData = extractions.map(ext => flattenExtraction(ext));

    // Convertir a CSV
    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' }); // Usar ; como separador (estándar EU)

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `verbadocpro_export_${timestamp}.csv`;

    return {
      success: true,
      buffer: Buffer.from(csv, 'utf-8'),
      filename,
      mimeType: 'text/csv'
    };

  } catch (error: any) {
    console.error('❌ Error al exportar a CSV:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// EXPORTAR A PDF
// ============================================================================

/**
 * Exportar extracciones a PDF consolidado
 */
export async function exportToPDF(options: ExportOptions): Promise<ExportResult> {
  try {
    const { extractionIds } = options;

    // Obtener datos
    const extractions = await getExtractionsData(extractionIds);

    if (extractions.length === 0) {
      return {
        success: false,
        error: 'No se encontraron extracciones para exportar'
      };
    }

    // Crear PDF
    const doc = new jsPDF();

    // Título
    doc.setFontSize(18);
    doc.text('VerbadocPro - Reporte de Extracciones', 14, 20);

    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 28);
    doc.text(`Total de documentos: ${extractions.length}`, 14, 34);

    // Tabla con datos principales
    const tableData = extractions.map(ext => [
      ext.filename || 'N/A',
      ext.status || 'N/A',
      ext.created_at ? new Date(ext.created_at).toLocaleDateString('es-ES') : 'N/A',
      ext.validation_errors_count || 0,
      ext.confidence_score ? `${(ext.confidence_score * 100).toFixed(1)}%` : 'N/A'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Archivo', 'Estado', 'Fecha', 'Errores', 'Confianza']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 }
    });

    // Generar buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `verbadocpro_export_${timestamp}.pdf`;

    return {
      success: true,
      buffer: pdfBuffer,
      filename,
      mimeType: 'application/pdf'
    };

  } catch (error: any) {
    console.error('❌ Error al exportar a PDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Obtener datos de extracciones
 */
async function getExtractionsData(extractionIds: string[]): Promise<any[]> {
  const placeholders = extractionIds.map((_, i) => `$${i + 1}`).join(',');

  const result = await sql.query(
    `SELECT
      er.*,
      (
        SELECT COUNT(*)
        FROM validation_errors ve
        WHERE ve.extraction_id = er.id
      ) as validation_errors_count
    FROM extraction_results er
    WHERE er.id IN (${placeholders})
    ORDER BY er.created_at DESC`,
    extractionIds
  );

  return result.rows;
}

/**
 * Aplanar estructura de extracción para Excel/CSV
 */
function flattenExtraction(extraction: any): Record<string, any> {
  const flat: Record<string, any> = {
    'ID': extraction.id,
    'Archivo': extraction.filename,
    'Estado': extraction.status,
    'Fecha de creación': extraction.created_at
      ? new Date(extraction.created_at).toLocaleString('es-ES')
      : '',
    'Modelo usado': extraction.model_used,
    'Confianza': extraction.confidence_score
      ? `${(extraction.confidence_score * 100).toFixed(1)}%`
      : '',
    'Errores de validación': extraction.validation_errors_count || 0,
    'Tiempo de procesamiento (ms)': extraction.processing_time_ms || ''
  };

  // Añadir campos extraídos
  if (extraction.extracted_data) {
    const data = extraction.extracted_data;

    for (const [key, value] of Object.entries(data)) {
      flat[`Dato: ${key}`] = value || '';
    }
  }

  return flat;
}

/**
 * Extraer errores de validación
 */
function extractValidationErrors(extractions: any[]): any[] {
  const errors: any[] = [];

  for (const ext of extractions) {
    if (ext.validation_errors_count > 0) {
      // Aquí podrías hacer una query adicional para obtener los errores
      errors.push({
        'Archivo': ext.filename,
        'ID Extracción': ext.id,
        'Total errores': ext.validation_errors_count
      });
    }
  }

  return errors;
}

/**
 * Obtener datos de validación cruzada
 */
async function getCrossValidationData(extractionIds: string[]): Promise<any[]> {
  const placeholders = extractionIds.map((_, i) => `$${i + 1}`).join(',');

  const result = await sql.query(
    `SELECT
      cvr.extraction_id,
      er.filename,
      cvr.matches,
      cvr.match_percentage,
      cvr.discrepancy_count,
      cvr.critical_discrepancies
    FROM cross_validation_results cvr
    INNER JOIN extraction_results er ON cvr.extraction_id = er.id
    WHERE cvr.extraction_id IN (${placeholders})`,
    extractionIds
  );

  return result.rows.map(row => ({
    'Archivo': row.filename,
    'ID Extracción': row.extraction_id,
    'Coincide': row.matches ? 'Sí' : 'No',
    'Porcentaje de coincidencia': `${row.match_percentage}%`,
    'Discrepancias': row.discrepancy_count,
    'Discrepancias críticas': row.critical_discrepancies
  }));
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Exportar según formato especificado
 */
export async function exportExtractions(options: ExportOptions): Promise<ExportResult> {
  switch (options.format) {
    case 'excel':
      return await exportToExcel(options);
    case 'csv':
      return await exportToCSV(options);
    case 'pdf':
      return await exportToPDF(options);
    default:
      return {
        success: false,
        error: `Formato no soportado: ${options.format}`
      };
  }
}

export default {
  exportExtractions,
  exportToExcel,
  exportToCSV,
  exportToPDF
};
