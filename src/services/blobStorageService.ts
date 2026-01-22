/**
 * Servicio de Almacenamiento en Vercel Blob
 *
 * Gestiona la subida, descarga y eliminación de PDFs en Vercel Blob Storage
 */

import { put, del, head } from '@vercel/blob';
import * as crypto from 'crypto';
import { analyzePDFFromBuffer, type PDFAnalysisResult } from './pdfAnalysisService.js';

// ============================================================================
// TIPOS
// ============================================================================

export interface UploadResult {
  success: boolean;
  url?: string;
  pathname?: string;
  size?: number;
  checksum?: string;
  pdfAnalysis?: PDFAnalysisResult;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// Estructura de carpetas por fecha
function getStoragePath(filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // Limpiar nombre de archivo
  const cleanFilename = filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();

  // Añadir timestamp para evitar colisiones
  const timestamp = Date.now();
  const basename = cleanFilename.replace(/\.pdf$/i, '');
  const uniqueFilename = `${basename}_${timestamp}.pdf`;

  return `pdfs/${year}/${month}/${day}/${uniqueFilename}`;
}

/**
 * Calcular SHA-256 checksum de un buffer
 */
function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Subir PDF a Vercel Blob
 */
export async function uploadPDF(
  buffer: Buffer,
  filename: string,
  metadata?: {
    userId?: string;
    extractionId?: string;
    analyzePDF?: boolean; // Si se debe analizar el tipo de PDF
  }
): Promise<UploadResult> {
  try {
    if (!BLOB_TOKEN) {
      return {
        success: false,
        error: 'BLOB_READ_WRITE_TOKEN no configurado'
      };
    }

    // Validar que es un PDF
    if (!isPDF(buffer)) {
      return {
        success: false,
        error: 'El archivo no es un PDF válido'
      };
    }

    const pathname = getStoragePath(filename);
    const checksum = calculateChecksum(buffer);

    console.log(`📤 Subiendo PDF: ${pathname} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Analizar tipo de PDF si se solicita (por defecto: true)
    let pdfAnalysis: PDFAnalysisResult | undefined;
    const shouldAnalyze = metadata?.analyzePDF !== false; // Por defecto true

    if (shouldAnalyze) {
      console.log('🔍 Analizando tipo de PDF...');
      pdfAnalysis = await analyzePDFFromBuffer(buffer);
      console.log(`   Tipo detectado: ${pdfAnalysis.type.toUpperCase()}`);
      console.log(`   Páginas: ${pdfAnalysis.pageCount} (${pdfAnalysis.textPagesCount} con texto)`);
      console.log(`   Requiere OCR: ${pdfAnalysis.type === 'image' ? 'SÍ' : 'NO'}`);
    }

    // Subir a Vercel Blob
    const blob = await put(pathname, buffer, {
      access: 'public',
      token: BLOB_TOKEN,
      addRandomSuffix: false, // Ya tenemos timestamp en el nombre
      contentType: 'application/pdf',
    });

    console.log(`✅ PDF subido exitosamente: ${blob.url}`);

    return {
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      size: buffer.length,
      checksum,
      pdfAnalysis
    };

  } catch (error: any) {
    console.error('❌ Error al subir PDF a Blob:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Eliminar PDF de Vercel Blob
 */
export async function deletePDF(url: string): Promise<DeleteResult> {
  try {
    if (!BLOB_TOKEN) {
      return {
        success: false,
        error: 'BLOB_READ_WRITE_TOKEN no configurado'
      };
    }

    console.log(`🗑️  Eliminando PDF: ${url}`);

    await del(url, { token: BLOB_TOKEN });

    console.log('✅ PDF eliminado exitosamente');

    return { success: true };

  } catch (error: any) {
    console.error('❌ Error al eliminar PDF de Blob:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verificar si un PDF existe en Blob
 */
export async function checkPDFExists(url: string): Promise<boolean> {
  try {
    if (!BLOB_TOKEN) {
      return false;
    }

    const result = await head(url, { token: BLOB_TOKEN });
    return !!result;

  } catch (error) {
    return false;
  }
}

/**
 * Subir PDF desde base64
 */
export async function uploadPDFFromBase64(
  base64Data: string,
  filename: string,
  metadata?: {
    userId?: string;
    extractionId?: string;
    analyzePDF?: boolean;
  }
): Promise<UploadResult> {
  try {
    // Remover data URI prefix si existe
    const base64Clean = base64Data.replace(/^data:application\/pdf;base64,/, '');

    // Convertir a buffer
    const buffer = Buffer.from(base64Clean, 'base64');

    return await uploadPDF(buffer, filename, metadata);

  } catch (error: any) {
    return {
      success: false,
      error: `Error al procesar base64: ${error.message}`
    };
  }
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Validar que un buffer es un PDF válido
 */
function isPDF(buffer: Buffer): boolean {
  // PDF signature: %PDF-
  if (buffer.length < 5) {
    return false;
  }

  const signature = buffer.slice(0, 5).toString('ascii');
  return signature === '%PDF-';
}

/**
 * Obtener información de un blob por URL
 */
export async function getBlobInfo(url: string): Promise<{
  exists: boolean;
  size?: number;
  uploadedAt?: Date;
} | null> {
  try {
    if (!BLOB_TOKEN) {
      return null;
    }

    const info = await head(url, { token: BLOB_TOKEN });

    if (!info) {
      return { exists: false };
    }

    return {
      exists: true,
      size: info.size,
      uploadedAt: info.uploadedAt
    };

  } catch (error) {
    return { exists: false };
  }
}

/**
 * Limpiar PDFs huérfanos (llamado por cron job)
 */
export async function cleanupOrphanBlobs(
  urls: string[]
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const url of urls) {
    const result = await deletePDF(url);
    if (result.success) {
      deleted++;
    } else {
      failed++;
    }

    // Pequeña pausa entre eliminaciones
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { deleted, failed };
}

export default {
  uploadPDF,
  uploadPDFFromBase64,
  deletePDF,
  checkPDFExists,
  getBlobInfo,
  cleanupOrphanBlobs
};
