/**
 * SERVICIO API PARA EXTRACCIONES
 * Funciones helper para interactuar con los endpoints de extracciones
 */

export interface ApiExtraction {
  id: string;
  user_id: string;
  filename: string;
  file_url: string | null;
  pdf_blob_url: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  page_count: number;
  extracted_data: any;
  validation_status: 'pending' | 'valid' | 'invalid' | 'needs_review' | 'approved' | 'rejected';
  status?: string; // Status returned by API (maps to validation_status or 'rejected' for unprocessable)
  source?: 'extraction' | 'unprocessable'; // Origin table: extraction_results or unprocessable_documents
  validation_errors_count: number;
  excel_validation_status?: string;
  excel_matched_record?: any;
  rejection_reason?: string;
  model_used: string;
  processing_time_ms: number | null;
  confidence_score: number | null;
  has_corrections: boolean;
  corrected_by_user_id?: string;
  corrected_at?: Date;
  correction_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateExtractionData {
  filename: string;
  extractedData: any;
  modelUsed: string;
  fileUrl?: string;
  fileType?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  processingTimeMs?: number;
  confidenceScore?: number;
}

/**
 * Error especial para documentos no procesables (422)
 * Contiene el ID para poder subir el PDF igualmente
 */
export class UnprocessableDocumentError extends Error {
  unprocessableId: string | null;
  category: string;
  reason: string;

  constructor(message: string, unprocessableId: string | null, category: string, reason: string) {
    super(message);
    this.name = 'UnprocessableDocumentError';
    this.unprocessableId = unprocessableId;
    this.category = category;
    this.reason = reason;
  }
}

/**
 * Crear una nueva extracción en la base de datos
 */
export async function createExtraction(data: CreateExtractionData): Promise<ApiExtraction> {
  const response = await fetch('/api/extractions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include', // Importante: incluir cookies
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();

    // Manejo especial para 422: documento no procesable pero con ID para subir PDF
    if (response.status === 422 && error.unprocessableId) {
      throw new UnprocessableDocumentError(
        error.error || 'Documento no procesable',
        error.unprocessableId,
        error.category || 'unknown',
        error.reason || 'Documento rechazado'
      );
    }

    throw new Error(error.error || 'Error al crear extracción');
  }

  const result = await response.json();
  return result.extraction;
}

/**
 * Obtener todas las extracciones del usuario
 */
export async function getExtractions(options?: {
  limit?: number;
  needsReview?: boolean;
  status?: 'pending' | 'valid' | 'rejected' | 'needs_review';
}): Promise<{
  extractions: ApiExtraction[];
  stats: {
    total: number;
    pending: number;
    valid: number;
    needsReview: number;
    rejected: number;
  };
  count: number;
}> {
  const params = new URLSearchParams();

  if (options?.limit) {
    params.append('limit', options.limit.toString());
  }

  if (options?.needsReview) {
    params.append('needsReview', 'true');
  }

  if (options?.status) {
    params.append('status', options.status);
  }

  const response = await fetch(`/api/extractions?${params.toString()}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener extracciones');
  }

  return await response.json();
}

/**
 * Obtener una extracción específica con sus errores
 */
export async function getExtraction(id: string): Promise<{
  extraction: ApiExtraction;
  errors: any[];
  errorsCount: number;
}> {
  const response = await fetch(`/api/extractions/${id}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener extracción');
  }

  return await response.json();
}

/**
 * Actualizar una extracción
 */
export async function updateExtraction(
  id: string,
  data: {
    extractedData?: any;
    validationStatus?: string;
    rejectionReason?: string;
  }
): Promise<ApiExtraction> {
  const response = await fetch(`/api/extractions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al actualizar extracción');
  }

  const result = await response.json();
  return result.extraction;
}

/**
 * Eliminar una extracción
 */
export async function deleteExtraction(id: string): Promise<void> {
  const response = await fetch(`/api/extractions/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al eliminar extracción');
  }
}

/**
 * Aprobar un formulario
 */
export async function approveExtraction(
  id: string,
  notes?: string
): Promise<ApiExtraction> {
  const response = await fetch(`/api/extractions/${id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ notes })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al aprobar extracción');
  }

  const result = await response.json();
  return result.extraction;
}

/**
 * Rechazar un formulario
 */
export async function rejectExtraction(
  id: string,
  reason: string
): Promise<ApiExtraction> {
  const response = await fetch(`/api/extractions/${id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al rechazar extracción');
  }

  const result = await response.json();
  return result.extraction;
}

/**
 * Corregir un error de validación
 */
export async function fixValidationError(
  errorId: string,
  correctedValue: any,
  notes?: string
): Promise<void> {
  const response = await fetch(`/api/validation-errors/${errorId}/fix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ correctedValue, notes })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al corregir error');
  }
}

/**
 * Ignorar un error de validación
 */
export async function ignoreValidationError(
  errorId: string,
  notes?: string
): Promise<void> {
  const response = await fetch(`/api/validation-errors/${errorId}/ignore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ notes })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al ignorar error');
  }
}
