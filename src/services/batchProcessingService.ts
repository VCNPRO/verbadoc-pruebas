/**
 * Servicio de Procesamiento Batch
 *
 * Gestiona el procesamiento paralelo de múltiples PDFs
 */

import { sql } from '@vercel/postgres';

// ============================================================================
// TIPOS
// ============================================================================

export interface BatchJob {
  id: string;
  userId: string;
  name: string;
  description?: string;
  modelUsed: string;
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
}

export interface BatchItem {
  id: string;
  batchId: string;
  extractionId?: string;
  filename: string;
  fileBlobUrl?: string;
  fileSizeBytes?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  processingOrder: number;
  resultSummary?: any;
  validationSummary?: any;
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
  errorMessage?: string;
  retryCount: number;
}

export interface CreateBatchOptions {
  userId: string;
  name: string;
  description?: string;
  modelUsed?: string;
  promptTemplate?: string;
  schemaConfig?: any;
  files: Array<{
    filename: string;
    fileBlobUrl?: string;
    fileSizeBytes?: number;
  }>;
  priority?: number;
}

export interface BatchStats {
  totalItems: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  completionPercentage: number;
  avgProcessingTimeMs: number;
  estimatedTimeRemainingMs?: number;
}

// ============================================================================
// CREAR BATCH
// ============================================================================

/**
 * Crear un nuevo batch job
 */
export async function createBatch(options: CreateBatchOptions): Promise<{ batchId: string }> {
  const {
    userId,
    name,
    description,
    modelUsed = 'gemini-2.5-flash',
    promptTemplate,
    schemaConfig,
    files,
    priority = 0
  } = options;

  if (files.length === 0) {
    throw new Error('El batch debe tener al menos un archivo');
  }

  if (files.length > 500) {
    throw new Error('El batch no puede tener más de 500 archivos');
  }

  // Crear batch job
  const batchResult = await sql`
    INSERT INTO batch_jobs (
      user_id,
      name,
      description,
      model_used,
      prompt_template,
      schema_config,
      total_files,
      priority
    ) VALUES (
      ${userId},
      ${name},
      ${description || null},
      ${modelUsed},
      ${promptTemplate || null},
      ${schemaConfig ? JSON.stringify(schemaConfig) : null}::jsonb,
      ${files.length},
      ${priority}
    )
    RETURNING id
  `;

  const batchId = batchResult.rows[0].id;

  // Insertar items del batch
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    await sql`
      INSERT INTO batch_items (
        batch_id,
        filename,
        file_blob_url,
        file_size_bytes,
        processing_order
      ) VALUES (
        ${batchId},
        ${file.filename},
        ${file.fileBlobUrl || null},
        ${file.fileSizeBytes || null},
        ${i + 1}
      )
    `;
  }

  console.log(`✅ Batch creado: ${batchId} con ${files.length} archivos`);

  return { batchId };
}

// ============================================================================
// CONSULTAS
// ============================================================================

/**
 * Obtener información de un batch
 */
export async function getBatch(batchId: string): Promise<BatchJob | null> {
  const result = await sql`
    SELECT * FROM batch_jobs
    WHERE id = ${batchId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    modelUsed: row.model_used,
    totalFiles: row.total_files,
    processedFiles: row.processed_files,
    successfulFiles: row.successful_files,
    failedFiles: row.failed_files,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    processingTimeMs: row.processing_time_ms
  };
}

/**
 * Obtener items de un batch
 */
export async function getBatchItems(batchId: string): Promise<BatchItem[]> {
  const result = await sql`
    SELECT * FROM batch_items
    WHERE batch_id = ${batchId}
    ORDER BY processing_order ASC
  `;

  return result.rows.map(row => ({
    id: row.id,
    batchId: row.batch_id,
    extractionId: row.extraction_id,
    filename: row.filename,
    fileBlobUrl: row.file_blob_url,
    fileSizeBytes: row.file_size_bytes,
    status: row.status,
    processingOrder: row.processing_order,
    resultSummary: row.result_summary,
    validationSummary: row.validation_summary,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    processingTimeMs: row.processing_time_ms,
    errorMessage: row.error_message,
    retryCount: row.retry_count
  }));
}

/**
 * Obtener estadísticas de un batch
 */
export async function getBatchStats(batchId: string): Promise<BatchStats> {
  const result = await sql`SELECT * FROM get_batch_stats(${batchId})`;

  if (result.rows.length === 0) {
    throw new Error('Batch no encontrado');
  }

  const row = result.rows[0];

  return {
    totalItems: parseInt(row.total_items),
    pending: parseInt(row.pending),
    processing: parseInt(row.processing),
    completed: parseInt(row.completed),
    failed: parseInt(row.failed),
    completionPercentage: parseFloat(row.completion_percentage),
    avgProcessingTimeMs: parseFloat(row.avg_processing_time_ms) || 0,
    estimatedTimeRemainingMs: row.estimated_time_remaining_ms
      ? parseInt(row.estimated_time_remaining_ms)
      : undefined
  };
}

/**
 * Listar batches de un usuario
 */
export async function listUserBatches(
  userId: string,
  limit: number = 50
): Promise<BatchJob[]> {
  const result = await sql`
    SELECT * FROM batch_jobs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    modelUsed: row.model_used,
    totalFiles: row.total_files,
    processedFiles: row.processed_files,
    successfulFiles: row.successful_files,
    failedFiles: row.failed_files,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    processingTimeMs: row.processing_time_ms
  }));
}

// ============================================================================
// PROCESAMIENTO
// ============================================================================

/**
 * Iniciar procesamiento de un batch
 */
export async function startBatch(batchId: string): Promise<void> {
  await sql`
    UPDATE batch_jobs
    SET
      status = 'processing',
      started_at = CURRENT_TIMESTAMP
    WHERE id = ${batchId}
    AND status = 'pending'
  `;

  console.log(`🚀 Batch iniciado: ${batchId}`);
}

/**
 * Actualizar estado de un item del batch
 */
export async function updateBatchItem(
  itemId: string,
  updates: {
    status?: string;
    extractionId?: string;
    resultSummary?: any;
    validationSummary?: any;
    processingTimeMs?: number;
    errorMessage?: string;
  }
): Promise<void> {
  const {
    status,
    extractionId,
    resultSummary,
    validationSummary,
    processingTimeMs,
    errorMessage
  } = updates;

  await sql`
    UPDATE batch_items
    SET
      status = COALESCE(${status || null}, status),
      extraction_id = COALESCE(${extractionId || null}, extraction_id),
      result_summary = COALESCE(${resultSummary ? JSON.stringify(resultSummary) : null}::jsonb, result_summary),
      validation_summary = COALESCE(${validationSummary ? JSON.stringify(validationSummary) : null}::jsonb, validation_summary),
      processing_time_ms = COALESCE(${processingTimeMs || null}, processing_time_ms),
      error_message = COALESCE(${errorMessage || null}, error_message),
      completed_at = CASE
        WHEN ${status} IN ('completed', 'failed') THEN CURRENT_TIMESTAMP
        ELSE completed_at
      END,
      started_at = CASE
        WHEN ${status} = 'processing' AND started_at IS NULL THEN CURRENT_TIMESTAMP
        ELSE started_at
      END
    WHERE id = ${itemId}
  `;
}

/**
 * Cancelar batch
 */
export async function cancelBatch(batchId: string): Promise<void> {
  // Marcar batch como cancelled
  await sql`
    UPDATE batch_jobs
    SET
      status = 'cancelled',
      completed_at = CURRENT_TIMESTAMP
    WHERE id = ${batchId}
    AND status IN ('pending', 'processing')
  `;

  // Marcar items pending como skipped
  await sql`
    UPDATE batch_items
    SET status = 'skipped'
    WHERE batch_id = ${batchId}
    AND status = 'pending'
  `;

  console.log(`🛑 Batch cancelado: ${batchId}`);
}

/**
 * Obtener siguiente item a procesar
 */
export async function getNextBatchItem(): Promise<{
  itemId: string;
  batchId: string;
  filename: string;
  fileBlobUrl: string;
  modelUsed: string;
  promptTemplate?: string;
} | null> {
  const result = await sql`SELECT * FROM get_next_batch_item()`;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    itemId: row.item_id,
    batchId: row.batch_id,
    filename: row.filename,
    fileBlobUrl: row.file_blob_url,
    modelUsed: row.model_used,
    promptTemplate: row.prompt_template
  };
}

export default {
  createBatch,
  getBatch,
  getBatchItems,
  getBatchStats,
  listUserBatches,
  startBatch,
  updateBatchItem,
  cancelBatch,
  getNextBatchItem
};
