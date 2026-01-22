/**
 * Generador de Datos de Prueba
 *
 * Crea datos ficticios para testing de todas las funcionalidades:
 * - Excel files mock
 * - Extraction results mock
 * - Batch jobs mock
 */

import * as XLSX from 'xlsx';
import { randomBytes } from 'crypto';

// ============================================================================
// TIPOS
// ============================================================================

export interface MockExtraction {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData: Record<string, any>;
  confidenceScore: number;
  modelUsed: string;
  createdAt: Date;
}

export interface MockReferenceData {
  formIdentifier: string;
  data: Record<string, any>;
}

// ============================================================================
// GENERADORES DE DATOS
// ============================================================================

/**
 * Genera datos de extracción mock aleatorios
 */
export function generateMockExtraction(overrides?: Partial<MockExtraction>): MockExtraction {
  const id = overrides?.id || `ext_${randomBytes(8).toString('hex')}`;
  const filename = overrides?.filename || `documento_${Math.floor(Math.random() * 10000)}.pdf`;

  const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const statuses: Array<'pending' | 'processing' | 'completed' | 'failed'> = ['completed', 'completed', 'completed', 'failed'];

  return {
    id,
    filename,
    status: overrides?.status || statuses[Math.floor(Math.random() * statuses.length)],
    extractedData: overrides?.extractedData || generateRandomExtractedData(),
    confidenceScore: overrides?.confidenceScore ?? (0.75 + Math.random() * 0.24),
    modelUsed: overrides?.modelUsed || models[Math.floor(Math.random() * models.length)],
    createdAt: overrides?.createdAt || new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    ...overrides
  };
}

/**
 * Genera datos extraídos aleatorios (simulando formularios)
 */
function generateRandomExtractedData(): Record<string, any> {
  const nombres = ['Juan García', 'María López', 'Pedro Martínez', 'Ana Rodríguez', 'Carlos Sánchez'];
  const empresas = ['Acme Corp', 'TechFlow SL', 'Innovatech SA', 'Global Services', 'Digital Solutions'];
  const ciudades = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];

  return {
    nombreCompleto: nombres[Math.floor(Math.random() * nombres.length)],
    dni: `${Math.floor(10000000 + Math.random() * 90000000)}${['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)]}`,
    empresa: empresas[Math.floor(Math.random() * empresas.length)],
    ciudad: ciudades[Math.floor(Math.random() * ciudades.length)],
    fechaInicio: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    importeTotal: (Math.random() * 10000 + 500).toFixed(2),
    numeroFormulario: `F-2024-${Math.floor(1000 + Math.random() * 9000)}`
  };
}

/**
 * Genera múltiples extracciones mock
 */
export function generateMockExtractions(count: number, overrides?: Partial<MockExtraction>): MockExtraction[] {
  return Array.from({ length: count }, () => generateMockExtraction(overrides));
}

/**
 * Genera datos de referencia mock (para validación cruzada)
 */
export function generateMockReferenceData(formIdentifier: string): MockReferenceData {
  return {
    formIdentifier,
    data: generateRandomExtractedData()
  };
}

/**
 * Crea archivo Excel mock con datos de referencia
 */
export function createMockExcelBuffer(data: Record<string, any>[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
}

/**
 * Crea un buffer PDF mock (firma PDF básica)
 */
export function createMockPDFBuffer(size: number = 1024): Buffer {
  // Firma PDF básica + contenido aleatorio
  const header = Buffer.from('%PDF-1.4\n');
  const content = randomBytes(size - header.length - 10);
  const footer = Buffer.from('\n%%EOF\n');

  return Buffer.concat([header, content, footer]);
}

/**
 * Genera datos de batch job mock
 */
export function generateMockBatchJob(fileCount: number = 10) {
  const batchId = `batch_${randomBytes(8).toString('hex')}`;

  return {
    id: batchId,
    name: `Prueba Batch ${new Date().toISOString()}`,
    description: `Batch de prueba con ${fileCount} archivos`,
    status: 'pending' as const,
    modelUsed: 'gemini-2.0-flash-exp',
    totalFiles: fileCount,
    processedFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    items: generateMockBatchItems(batchId, fileCount)
  };
}

/**
 * Genera items de batch mock
 */
function generateMockBatchItems(batchId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item_${randomBytes(8).toString('hex')}`,
    batchId,
    filename: `documento_batch_${i + 1}.pdf`,
    status: 'pending' as const,
    priority: Math.floor(Math.random() * 100),
    fileBlobUrl: `https://blob.vercel-storage.com/mock/file_${i + 1}.pdf`
  }));
}

// ============================================================================
// DATASETS PREDEFINIDOS
// ============================================================================

/**
 * Dataset pequeño: 10 extracciones
 */
export const SMALL_DATASET = {
  name: 'Small Dataset',
  extractions: generateMockExtractions(10),
  description: '10 extracciones para pruebas rápidas'
};

/**
 * Dataset medio: 100 extracciones
 */
export const MEDIUM_DATASET = {
  name: 'Medium Dataset',
  extractions: generateMockExtractions(100),
  description: '100 extracciones para pruebas de carga media'
};

/**
 * Dataset grande: 1000 extracciones (límite del sistema)
 */
export const LARGE_DATASET = {
  name: 'Large Dataset',
  extractions: generateMockExtractions(1000),
  description: '1000 extracciones para pruebas de alta carga'
};

/**
 * Dataset con errores: mezcla de estados
 */
export const ERROR_DATASET = {
  name: 'Error Dataset',
  extractions: [
    ...generateMockExtractions(50, { status: 'completed' }),
    ...generateMockExtractions(25, { status: 'failed' }),
    ...generateMockExtractions(15, { status: 'processing' }),
    ...generateMockExtractions(10, { status: 'pending' })
  ],
  description: 'Dataset con mezcla de estados para testing de errores'
};

/**
 * Dataset de baja confianza
 */
export const LOW_CONFIDENCE_DATASET = {
  name: 'Low Confidence Dataset',
  extractions: generateMockExtractions(50, { confidenceScore: 0.3 + Math.random() * 0.3 }),
  description: 'Extracciones con baja confianza (< 60%)'
};

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Genera Excel de referencia con formato estándar español
 */
export function generateSpanishReferenceExcel(rows: number = 100): Buffer {
  const data = Array.from({ length: rows }, (_, i) => {
    const extraction = generateRandomExtractedData();
    return {
      'Nombre Completo': extraction.nombreCompleto,
      'DNI/NIF': extraction.dni,
      'Empresa': extraction.empresa,
      'Ciudad': extraction.ciudad,
      'Fecha de Inicio': extraction.fechaInicio,
      'Importe Total': extraction.importeTotal,
      'Número de Formulario': extraction.numeroFormulario
    };
  });

  return createMockExcelBuffer(data);
}

/**
 * Calcula estadísticas de un dataset
 */
export function calculateDatasetStats(extractions: MockExtraction[]) {
  const statusCounts = extractions.reduce((acc, ext) => {
    acc[ext.status] = (acc[ext.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgConfidence = extractions.reduce((sum, ext) => sum + ext.confidenceScore, 0) / extractions.length;

  const modelCounts = extractions.reduce((acc, ext) => {
    acc[ext.modelUsed] = (acc[ext.modelUsed] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: extractions.length,
    byStatus: statusCounts,
    byModel: modelCounts,
    avgConfidence: avgConfidence.toFixed(3),
    confidenceDistribution: {
      high: extractions.filter(e => e.confidenceScore >= 0.8).length,
      medium: extractions.filter(e => e.confidenceScore >= 0.6 && e.confidenceScore < 0.8).length,
      low: extractions.filter(e => e.confidenceScore < 0.6).length
    }
  };
}

export default {
  generateMockExtraction,
  generateMockExtractions,
  generateMockReferenceData,
  createMockExcelBuffer,
  createMockPDFBuffer,
  generateMockBatchJob,
  generateSpanishReferenceExcel,
  calculateDatasetStats,
  SMALL_DATASET,
  MEDIUM_DATASET,
  LARGE_DATASET,
  ERROR_DATASET,
  LOW_CONFIDENCE_DATASET
};
