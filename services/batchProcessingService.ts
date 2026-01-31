// Batch Processing Service - Procesamiento masivo de documentos
import { classifyDocument, validateExtractedData, type DocumentClassification, type ValidationResult } from './aiAgentService.ts';
import { extractDataFromDocument, type GeminiModel } from './geminiService.ts';
import { segmentPDFWithGemini, extractSegmentAsImage, isPDFFile, type SegmentationResult, type DocumentSegment } from './segmentationService.ts';

// ============================================
// TIPOS Y INTERFACES
// ============================================

export interface BatchJob {
  id: string;
  files: File[];
  status: 'pending' | 'processing' | 'completed' | 'error' | 'paused';
  progress: BatchProgress;
  results: BatchResult[];
  settings: BatchSettings;
  startTime: string;
  endTime?: string;
  totalCost?: number;
}

export interface BatchProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentFile?: string;
  percentComplete: number;
}

export interface BatchSettings {
  autoClassify: boolean;
  autoValidate: boolean;
  segmentPDFs: boolean;
  skipErrors: boolean;
  model: GeminiModel;
}

export interface BatchResult {
  fileName: string;
  fileIndex: number;
  status: 'success' | 'error' | 'skipped';
  classification?: DocumentClassification;
  extractedData?: object;
  validation?: ValidationResult;
  segmentation?: SegmentationResult;
  segments?: SegmentResult[];
  processingTime: number;
  error?: string;
  cost?: number;
}

export interface SegmentResult {
  segment: DocumentSegment;
  classification?: DocumentClassification;
  extractedData?: object;
  validation?: ValidationResult;
}

// ============================================
// PROCESAMIENTO POR LOTES
// ============================================

/**
 * Procesa múltiples documentos automáticamente
 * Soporta clasificación, extracción, validación y segmentación
 *
 * @param files - Archivos a procesar
 * @param settings - Configuración del procesamiento
 * @param onProgress - Callback para actualizar progreso
 * @returns Job completo con resultados
 */
export async function processBatch(
  files: File[],
  settings: BatchSettings,
  onProgress?: (progress: BatchProgress) => void
): Promise<BatchJob> {

  const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const job: BatchJob = {
    id: jobId,
    files,
    status: 'processing',
    settings,
    progress: {
      total: files.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      percentComplete: 0
    },
    results: [],
    startTime: new Date().toISOString()
  };

  console.log(`🚀 Iniciando procesamiento de lote: ${files.length} archivos`);
  console.log(`⚙️ Configuración:`, settings);

  let totalCost = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const startTime = Date.now();

    // Actualizar progreso
    job.progress.currentFile = file.name;
    if (onProgress) {
      onProgress(job.progress);
    }

    try {
      console.log(`\n📄 [${i + 1}/${files.length}] Procesando: ${file.name}`);

      let result: BatchResult;

      // Verificar si es PDF para segmentar
      if (settings.segmentPDFs && isPDFFile(file)) {
        result = await processMultiDocumentPDF(file, i, settings);
      } else {
        result = await processSingleDocument(file, i, settings);
      }

      result.processingTime = Date.now() - startTime;
      job.results.push(result);
      job.progress.successful++;

      if (result.cost) {
        totalCost += result.cost;
      }

      console.log(`✅ [${i + 1}/${files.length}] Completado: ${file.name} (${result.processingTime}ms)`);

    } catch (error) {
      console.error(`❌ [${i + 1}/${files.length}] Error procesando ${file.name}:`, error);

      const errorResult: BatchResult = {
        fileName: file.name,
        fileIndex: i,
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido',
        processingTime: Date.now() - startTime
      };

      job.results.push(errorResult);
      job.progress.failed++;

      // Si skipErrors está desactivado, detener el batch
      if (!settings.skipErrors) {
        console.log('⏸️ Procesamiento detenido por error (skipErrors: false)');
        job.status = 'error';
        break;
      }
    }

    job.progress.processed++;
    job.progress.percentComplete = Math.round((job.progress.processed / job.progress.total) * 100);

    if (onProgress) {
      onProgress(job.progress);
    }
  }

  job.status = job.progress.failed > 0 && !settings.skipErrors ? 'error' : 'completed';
  job.endTime = new Date().toISOString();
  job.totalCost = totalCost;

  const duration = Date.now() - new Date(job.startTime).getTime();

  console.log(`\n✅ Lote completado en ${(duration / 1000).toFixed(1)}s`);
  console.log(`📊 Resultados: ${job.progress.successful} exitosos, ${job.progress.failed} errores`);
  console.log(`💰 Coste total estimado: $${totalCost.toFixed(4)}`);

  return job;
}

/**
 * Procesa un documento individual
 */
async function processSingleDocument(
  file: File,
  index: number,
  settings: BatchSettings
): Promise<BatchResult> {

  const result: BatchResult = {
    fileName: file.name,
    fileIndex: index,
    status: 'success',
    processingTime: 0,
    cost: 0
  };

  // 1. Clasificación (si está habilitada)
  if (settings.autoClassify) {
    result.classification = await classifyDocument(file, 'gemini-3-pro-preview');
    result.cost! += 0.0005; // Coste estimado clasificación
    console.log(`  🏷️  Clasificado: ${result.classification.type} (${(result.classification.confidence * 100).toFixed(0)}%)`);
  }

  // 2. Extracción de datos
  const schema = result.classification?.suggestedSchema || [];
  const prompt = result.classification?.suggestedPrompt || 'Extrae los datos clave de este documento.';

  if (schema.length > 0) {
    result.extractedData = await extractDataFromDocument(file, schema, prompt, settings.model);
    result.cost! += settings.model === 'gemini-3-pro-preview' ? 0.0005 : 0.0016;
    console.log(`  📝 Datos extraídos: ${Object.keys(result.extractedData).length} campos`);
  }

  // 3. Validación (si está habilitada)
  if (settings.autoValidate && result.extractedData && schema.length > 0) {
    result.validation = await validateExtractedData(result.extractedData, schema, file, 'gemini-3-pro-preview');
    result.cost! += result.validation.issues.length > 0 ? 0.0005 : 0; // Solo cobra si hace validación IA
    console.log(`  ✅ Validación: Score ${result.validation.score}/100 (${result.validation.issues.length} issues)`);
  }

  return result;
}

/**
 * Procesa un PDF que puede contener múltiples documentos
 */
async function processMultiDocumentPDF(
  file: File,
  index: number,
  settings: BatchSettings
): Promise<BatchResult> {

  const result: BatchResult = {
    fileName: file.name,
    fileIndex: index,
    status: 'success',
    processingTime: 0,
    cost: 0,
    segments: []
  };

  console.log(`  🔍 Segmentando PDF...`);

  // 1. Segmentar el PDF
  result.segmentation = await segmentPDFWithGemini(file, settings.model);
  result.cost! += settings.model === 'gemini-3-pro-preview' ? 0.0005 : 0.0016;

  console.log(`  📑 Detectados ${result.segmentation.segmentsFound} documentos en el PDF`);

  // 2. Procesar cada segmento
  for (const segment of result.segmentation.segments) {
    console.log(`    📄 Procesando segmento: ${segment.id} (${segment.documentType})`);

    try {
      // Extraer segmento como imagen
      const segmentFile = await extractSegmentAsImage(file, segment);

      const segmentResult: SegmentResult = {
        segment
      };

      // Clasificar si está habilitado
      if (settings.autoClassify) {
        segmentResult.classification = await classifyDocument(segmentFile, 'gemini-3-pro-preview');
        result.cost! += 0.0005;
      }

      // Extraer datos
      const schema = segmentResult.classification?.suggestedSchema || [];
      const prompt = segmentResult.classification?.suggestedPrompt || 'Extrae los datos clave.';

      if (schema.length > 0) {
        segmentResult.extractedData = await extractDataFromDocument(segmentFile, schema, prompt, settings.model);
        result.cost! += settings.model === 'gemini-3-pro-preview' ? 0.0005 : 0.0016;
      }

      // Validar si está habilitado
      if (settings.autoValidate && segmentResult.extractedData && schema.length > 0) {
        segmentResult.validation = await validateExtractedData(segmentResult.extractedData, schema, segmentFile, 'gemini-3-pro-preview');
        result.cost! += 0.0005;
      }

      result.segments!.push(segmentResult);

    } catch (error) {
      console.error(`    ❌ Error procesando segmento ${segment.id}:`, error);
    }
  }

  return result;
}

// ============================================
// PROCESAMIENTO PARALELO (Avanzado)
// ============================================

/**
 * Procesa múltiples documentos EN PARALELO
 * ADVERTENCIA: Puede exceder rate limits de la API si procesas demasiados a la vez
 *
 * @param files - Archivos a procesar
 * @param settings - Configuración
 * @param batchSize - Cuántos archivos procesar simultáneamente (default: 3)
 */
export async function processBatchParallel(
  files: File[],
  settings: BatchSettings,
  batchSize: number = 3,
  onProgress?: (progress: BatchProgress) => void
): Promise<BatchJob> {

  const jobId = `batch_parallel_${Date.now()}`;

  const job: BatchJob = {
    id: jobId,
    files,
    status: 'processing',
    settings,
    progress: {
      total: files.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      percentComplete: 0
    },
    results: [],
    startTime: new Date().toISOString()
  };

  console.log(`🚀 Procesamiento PARALELO: ${files.length} archivos en lotes de ${batchSize}`);

  // Procesar en lotes paralelos
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    console.log(`\n📦 Procesando lote ${Math.floor(i / batchSize) + 1}: archivos ${i + 1}-${Math.min(i + batchSize, files.length)}`);

    // Procesar batch en paralelo
    const batchResults = await Promise.allSettled(
      batch.map((file, idx) => processSingleDocument(file, i + idx, settings))
    );

    // Agregar resultados
    batchResults.forEach((promiseResult, idx) => {
      if (promiseResult.status === 'fulfilled') {
        job.results.push(promiseResult.value);
        job.progress.successful++;
      } else {
        const errorResult: BatchResult = {
          fileName: batch[idx].name,
          fileIndex: i + idx,
          status: 'error',
          error: promiseResult.reason?.message || 'Error desconocido',
          processingTime: 0
        };
        job.results.push(errorResult);
        job.progress.failed++;
      }
      job.progress.processed++;
    });

    job.progress.percentComplete = Math.round((job.progress.processed / job.progress.total) * 100);

    if (onProgress) {
      onProgress(job.progress);
    }
  }

  job.status = 'completed';
  job.endTime = new Date().toISOString();

  console.log(`\n✅ Procesamiento paralelo completado`);
  console.log(`📊 ${job.progress.successful} exitosos, ${job.progress.failed} errores`);

  return job;
}

// ============================================
// EXPORTACIÓN DE RESULTADOS
// ============================================

/**
 * Exporta los resultados de un batch a JSON
 */
export function exportBatchToJSON(job: BatchJob): void {
  const data = {
    jobId: job.id,
    files: job.files.map(f => f.name),
    status: job.status,
    progress: job.progress,
    results: job.results.map(r => ({
      fileName: r.fileName,
      status: r.status,
      classification: r.classification?.type,
      extractedData: r.extractedData,
      validation: {
        isValid: r.validation?.isValid,
        score: r.validation?.score,
        issues: r.validation?.issues
      },
      processingTime: r.processingTime
    })),
    startTime: job.startTime,
    endTime: job.endTime,
    totalCost: job.totalCost
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `batch_${job.id}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  console.log(`📥 Resultados exportados: batch_${job.id}.json`);
}

/**
 * Exporta los resultados de un batch a Excel
 */
export async function exportBatchToExcel(job: BatchJob): Promise<void> {
  try {
    const XLSX = await import('xlsx');

    // Crear datos para Excel
    const excelData: any[] = [];

    job.results.forEach(result => {
      if (result.segments && result.segments.length > 0) {
        // Si tiene segmentos, crear una fila por segmento
        result.segments.forEach((seg, idx) => {
          excelData.push({
            'Archivo': result.fileName,
            'Segmento': idx + 1,
            'Tipo Documento': seg.classification?.type || seg.segment.documentType,
            'Estado': result.status,
            'Datos Extraídos': JSON.stringify(seg.extractedData || {}),
            'Score Validación': seg.validation?.score || 'N/A',
            'Errores': seg.validation?.issues.length || 0,
            'Tiempo (ms)': result.processingTime
          });
        });
      } else {
        // Documento individual
        excelData.push({
          'Archivo': result.fileName,
          'Tipo Documento': result.classification?.type || 'N/A',
          'Estado': result.status,
          'Datos Extraídos': JSON.stringify(result.extractedData || {}),
          'Score Validación': result.validation?.score || 'N/A',
          'Errores': result.validation?.issues.length || 0,
          'Tiempo (ms)': result.processingTime
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');

    XLSX.writeFile(workbook, `batch_${job.id}_${new Date().toISOString().split('T')[0]}.xlsx`);

    console.log(`📊 Resultados exportados a Excel`);

  } catch (error) {
    console.error('Error exportando a Excel:', error);
    throw error;
  }
}
