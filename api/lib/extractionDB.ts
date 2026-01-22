/**
 * SERVICIO DE BASE DE DATOS PARA EXTRACCIONES DE FORMULARIOS FUNDAE
 * src/lib/extractionDB.ts
 *
 * Maneja todas las operaciones CRUD para:
 * - extraction_results (formularios procesados)
 * - validation_errors (errores de validación)
 * - email_notifications (log de emails)
 */

import { sql } from '@vercel/postgres';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExtractionResult {
  id: string;
  user_id: string;

  // Metadata del archivo
  filename: string;
  file_url: string | null;
  pdf_blob_url?: string | null;
  pdf_blob_pathname?: string | null;
  pdf_stored_at?: Date | null;
  file_type: string | null;
  file_size_bytes: number | null;
  page_count: number;

  // Datos extraídos
  extracted_data: any; // JSON flexible

  // Validación
  validation_status: 'pending' | 'valid' | 'invalid' | 'needs_review' | 'approved' | 'rejected';
  validation_errors_count: number;

  // Validación cruzada con Excel
  excel_validation_status?: 'valid' | 'rejected' | 'not_found' | 'not_checked';
  excel_matched_record?: any;
  rejection_reason?: string;

  // Procesamiento IA
  model_used: string;
  processing_time_ms: number | null;
  confidence_score: number | null;

  // Correcciones
  has_corrections: boolean;
  corrected_by_user_id?: string;
  corrected_at?: Date;
  correction_notes?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export interface ValidationError {
  id: string;
  extraction_id: string;

  // Detalles del error
  field_name: string;
  error_type: string;
  error_message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';

  // Valor problemático
  invalid_value?: string;
  expected_format?: string;
  suggested_correction?: string;

  // Posición en el documento
  page_number?: number;
  field_position?: { x: number; y: number; width: number; height: number };

  // Resolución
  status: 'pending' | 'fixed' | 'ignored' | 'auto_fixed';
  resolved_by_user_id?: string;
  resolved_at?: Date;
  corrected_value?: string;
  resolution_notes?: string;

  created_at: Date;
}

export interface EmailNotification {
  id: string;
  extraction_id?: string;

  // Detalles del email
  recipient_email: string;
  subject: string;
  notification_type: string;
  email_body?: string;

  // Estado
  status: 'pending' | 'sent' | 'failed';
  sent_at?: Date;
  error_message?: string;

  // Proveedor
  provider: string;
  provider_message_id?: string;

  created_at: Date;
}

// ============================================================================
// SERVICIO: ExtractionResultDB
// ============================================================================

export const ExtractionResultDB = {
  /**
   * Crear un nuevo resultado de extracción
   */
  create: async (data: {
    userId: string;
    filename: string;
    extractedData: any;
    modelUsed: string;
    fileUrl?: string;
    fileType?: string;
    fileSizeBytes?: number;
    pageCount?: number;
    processingTimeMs?: number;
    confidenceScore?: number;
  }): Promise<ExtractionResult> => {
    const result = await sql<ExtractionResult>`
      INSERT INTO extraction_results (
        user_id,
        filename,
        file_url,
        pdf_blob_url,
        file_type,
        file_size_bytes,
        page_count,
        extracted_data,
        model_used,
        processing_time_ms,
        confidence_score,
        validation_status
      )
      VALUES (
        ${data.userId},
        ${data.filename},
        ${data.fileUrl || null},
        ${data.fileUrl || null},
        ${data.fileType || null},
        ${data.fileSizeBytes || null},
        ${data.pageCount || 1},
        ${JSON.stringify(data.extractedData)},
        ${data.modelUsed},
        ${data.processingTimeMs || null},
        ${data.confidenceScore || null},
        'pending'
      )
      RETURNING *
    `;
    return result.rows[0];
  },

  /**
   * Obtener extracción por ID
   */
  findById: async (id: string): Promise<ExtractionResult | null> => {
    const result = await sql<ExtractionResult>`
      SELECT * FROM extraction_results WHERE id = ${id} LIMIT 1
    `;
    return result.rows[0] || null;
  },

  /**
   * Obtener extracciones de un usuario
   */
  findByUserId: async (userId: string, limit: number = 50): Promise<ExtractionResult[]> => {
    const result = await sql<ExtractionResult>`
      SELECT * FROM extraction_results
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  /**
   * Obtener extracciones que necesitan revisión
   */
  findNeedingReview: async (userId?: string, limit: number = 50): Promise<ExtractionResult[]> => {
    if (userId) {
      const result = await sql<ExtractionResult>`
        SELECT * FROM extraction_results
        WHERE validation_status = 'needs_review' AND user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return result.rows;
    } else {
      const result = await sql<ExtractionResult>`
        SELECT * FROM extraction_results
        WHERE validation_status = 'needs_review'
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return result.rows;
    }
  },

  /**
   * Actualizar estado de validación
   */
  updateValidationStatus: async (
    id: string,
    status: 'pending' | 'valid' | 'invalid' | 'needs_review' | 'approved' | 'rejected',
    rejectionReason?: string
  ): Promise<boolean> => {
    const result = await sql`
      UPDATE extraction_results
      SET validation_status = ${status},
          rejection_reason = ${rejectionReason || null}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Actualizar validación cruzada con Excel
   */
  updateExcelValidation: async (
    id: string,
    excelStatus: 'valid' | 'rejected' | 'not_found',
    matchedRecord?: any,
    rejectionReason?: string
  ): Promise<boolean> => {
    const result = await sql`
      UPDATE extraction_results
      SET excel_validation_status = ${excelStatus},
          excel_matched_record = ${matchedRecord ? JSON.stringify(matchedRecord) : null},
          rejection_reason = ${rejectionReason || null}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Marcar como corregido
   */
  markAsCorrected: async (
    id: string,
    correctedByUserId: string,
    notes?: string
  ): Promise<boolean> => {
    const result = await sql`
      UPDATE extraction_results
      SET has_corrections = TRUE,
          corrected_by_user_id = ${correctedByUserId},
          corrected_at = CURRENT_TIMESTAMP,
          correction_notes = ${notes || null},
          validation_status = 'approved'
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Actualizar datos extraídos (después de corrección)
   */
  updateExtractedData: async (id: string, extractedData: any): Promise<boolean> => {
    const result = await sql`
      UPDATE extraction_results
      SET extracted_data = ${JSON.stringify(extractedData)}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Actualizar un campo específico en extracted_data usando jsonb_set
   */
  updateExtractedField: async (
    id: string,
    fieldPath: string,
    newValue: any
  ): Promise<boolean> => {
    // Convertir "valoracion.pregunta1" a ["valoracion", "pregunta1"]
    const pathArray = fieldPath.split('.');

    const result = await sql`
      UPDATE extraction_results
      SET extracted_data = jsonb_set(
        extracted_data,
        ${`{${pathArray.join(',')}}` as any},
        ${JSON.stringify(newValue)}
      )
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Eliminar extracción
   */
  delete: async (id: string, userId: string): Promise<boolean> => {
    const result = await sql`
      DELETE FROM extraction_results
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Obtener estadísticas del usuario
   * 🔥 CORREGIDO: Cuenta extraction_results + unprocessable_documents
   */
  getStats: async (userId: string): Promise<{
    total: number;
    pending: number;
    valid: number;
    needsReview: number;
    rejected: number;
  }> => {
    // Estadísticas de extraction_results
    const extractionsResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE validation_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE validation_status = 'valid' OR validation_status = 'approved') as valid,
        COUNT(*) FILTER (WHERE validation_errors_count > 0) as needs_review
      FROM extraction_results
      WHERE user_id = ${userId}
    `;

    // Contar rechazados (unprocessable_documents)
    const rejectedResult = await sql`
      SELECT COUNT(*) as rejected
      FROM unprocessable_documents
      WHERE user_id = ${userId}
    `;

    const extractionStats = extractionsResult.rows[0];
    const rejectedStats = rejectedResult.rows[0];

    const extractionsTotal = parseInt(extractionStats.total);
    const rejectedTotal = parseInt(rejectedStats.rejected);

    return {
      total: extractionsTotal + rejectedTotal, // Total = extractions + rechazados
      pending: parseInt(extractionStats.pending),
      valid: parseInt(extractionStats.valid),
      needsReview: parseInt(extractionStats.needs_review), // Con errores
      rejected: rejectedTotal // Desde unprocessable_documents
    };
  },

  /**
   * Actualizar extracción (método genérico)
   */
  update: async (id: string, data: {
    status?: 'pending' | 'valid' | 'invalid' | 'needs_review' | 'approved' | 'rejected';
    rejectionReason?: string;
    extractedData?: any;
    validationErrorsCount?: number;
  }): Promise<boolean> => {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`validation_status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.rejectionReason !== undefined) {
      updates.push(`rejection_reason = $${paramIndex++}`);
      values.push(data.rejectionReason);
    }

    if (data.extractedData !== undefined) {
      updates.push(`extracted_data = $${paramIndex++}`);
      values.push(JSON.stringify(data.extractedData));
    }

    if (data.validationErrorsCount !== undefined) {
      updates.push(`validation_errors_count = $${paramIndex++}`);
      values.push(data.validationErrorsCount);
    }

    if (updates.length === 0) {
      return false;
    }

    values.push(id);
    const query = `UPDATE extraction_results SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

    const result = await sql.query(query, values);
    return (result.rowCount ?? 0) > 0;
  }
};

// ============================================================================
// SERVICIO: ValidationErrorDB
// ============================================================================

export const ValidationErrorDB = {
  /**
   * Crear un error de validación
   */
  create: async (data: {
    extractionId: string;
    fieldName: string;
    errorType: string;
    errorMessage: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    invalidValue?: string;
    expectedFormat?: string;
    suggestedCorrection?: string;
    pageNumber?: number;
    fieldPosition?: { x: number; y: number; width: number; height: number };
  }): Promise<ValidationError> => {
    const result = await sql<ValidationError>`
      INSERT INTO validation_errors (
        extraction_id,
        field_name,
        error_type,
        error_message,
        severity,
        invalid_value,
        expected_format,
        suggested_correction,
        page_number,
        field_position
      )
      VALUES (
        ${data.extractionId},
        ${data.fieldName},
        ${data.errorType},
        ${data.errorMessage},
        ${data.severity || 'medium'},
        ${data.invalidValue || null},
        ${data.expectedFormat || null},
        ${data.suggestedCorrection || null},
        ${data.pageNumber || null},
        ${data.fieldPosition ? JSON.stringify(data.fieldPosition) : null}
      )
      RETURNING *
    `;
    return result.rows[0];
  },

  /**
   * Crear múltiples errores en batch
   */
  createMany: async (errors: Array<{
    extractionId: string;
    fieldName: string;
    errorType: string;
    errorMessage: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    invalidValue?: string;
    expectedFormat?: string;
    suggestedCorrection?: string;
    pageNumber?: number;
  }>): Promise<void> => {
    for (const error of errors) {
      await ValidationErrorDB.create(error);
    }
  },

  /**
   * Obtener errores de una extracción
   */
  findByExtractionId: async (extractionId: string): Promise<ValidationError[]> => {
    const result = await sql<ValidationError>`
      SELECT * FROM validation_errors
      WHERE extraction_id = ${extractionId}
      ORDER BY created_at ASC
    `;
    return result.rows;
  },

  /**
   * Obtener errores pendientes de una extracción
   */
  findPendingByExtractionId: async (extractionId: string): Promise<ValidationError[]> => {
    const result = await sql<ValidationError>`
      SELECT * FROM validation_errors
      WHERE extraction_id = ${extractionId} AND status = 'pending'
      ORDER BY severity DESC, created_at ASC
    `;
    return result.rows;
  },

  /**
   * Marcar error como resuelto
   */
  markAsFixed: async (
    id: string,
    resolvedByUserId: string,
    correctedValue?: string,
    notes?: string
  ): Promise<boolean> => {
    const result = await sql`
      UPDATE validation_errors
      SET status = 'fixed',
          resolved_by_user_id = ${resolvedByUserId},
          resolved_at = CURRENT_TIMESTAMP,
          corrected_value = ${correctedValue || null},
          resolution_notes = ${notes || null}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Marcar error como ignorado
   */
  markAsIgnored: async (
    id: string,
    resolvedByUserId: string,
    notes?: string
  ): Promise<boolean> => {
    const result = await sql`
      UPDATE validation_errors
      SET status = 'ignored',
          resolved_by_user_id = ${resolvedByUserId},
          resolved_at = CURRENT_TIMESTAMP,
          resolution_notes = ${notes || null}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Eliminar todos los errores de una extracción
   */
  deleteByExtractionId: async (extractionId: string): Promise<boolean> => {
    const result = await sql`
      DELETE FROM validation_errors WHERE extraction_id = ${extractionId}
    `;
    return (result.rowCount ?? 0) > 0;
  }
};

// ============================================================================
// SERVICIO: EmailNotificationDB
// ============================================================================

export const EmailNotificationDB = {
  /**
   * Crear log de email
   */
  create: async (data: {
    extractionId?: string;
    recipientEmail: string;
    subject: string;
    notificationType: string;
    emailBody?: string;
    provider?: string;
  }): Promise<EmailNotification> => {
    const result = await sql<EmailNotification>`
      INSERT INTO email_notifications (
        extraction_id,
        recipient_email,
        subject,
        notification_type,
        email_body,
        provider,
        status
      )
      VALUES (
        ${data.extractionId || null},
        ${data.recipientEmail},
        ${data.subject},
        ${data.notificationType},
        ${data.emailBody || null},
        ${data.provider || 'resend'},
        'pending'
      )
      RETURNING *
    `;
    return result.rows[0];
  },

  /**
   * Marcar email como enviado
   */
  markAsSent: async (
    id: string,
    providerMessageId?: string
  ): Promise<boolean> => {
    const result = await sql`
      UPDATE email_notifications
      SET status = 'sent',
          sent_at = CURRENT_TIMESTAMP,
          provider_message_id = ${providerMessageId || null}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Marcar email como fallido
   */
  markAsFailed: async (
    id: string,
    errorMessage: string
  ): Promise<boolean> => {
    const result = await sql`
      UPDATE email_notifications
      SET status = 'failed',
          error_message = ${errorMessage}
      WHERE id = ${id}
    `;
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Obtener emails por extracción
   */
  findByExtractionId: async (extractionId: string): Promise<EmailNotification[]> => {
    const result = await sql<EmailNotification>`
      SELECT * FROM email_notifications
      WHERE extraction_id = ${extractionId}
      ORDER BY created_at DESC
    `;
    return result.rows;
  },

  /**
   * Obtener emails pendientes de envío
   */
  findPending: async (limit: number = 50): Promise<EmailNotification[]> => {
    const result = await sql<EmailNotification>`
      SELECT * FROM email_notifications
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return result.rows;
  },

  /**
   * Obtener estadísticas de emails
   */
  getStats: async (): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> => {
    const result = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM email_notifications
    `;

    const stats = result.rows[0];
    return {
      total: parseInt(stats.total),
      sent: parseInt(stats.sent),
      failed: parseInt(stats.failed),
      pending: parseInt(stats.pending)
    };
  }
};

export default { ExtractionResultDB, ValidationErrorDB, EmailNotificationDB };
