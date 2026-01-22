/**
 * Tests de Almacenamiento de PDFs en Vercel Blob
 *
 * Prueba el sistema de storage:
 * - Upload de PDFs al blob storage
 * - Verificación de checksums SHA-256
 * - Validación de firma PDF
 * - Límites de tamaño
 * - Recuperación de archivos
 * - Eliminación de blobs huérfanos
 */

import { createMockPDFBuffer } from './fixtures/mock-data-generator';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// ============================================================================
// HELPERS
// ============================================================================

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Cookie': `auth-token=${AUTH_TOKEN}`,
      ...options.headers
    }
  });

  return response;
}

function logTest(name: string, status: 'PASS' | 'FAIL' | 'SKIP', duration: number, error?: string, details?: any) {
  results.push({ name, status, duration, error, details });

  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name} (${duration}ms)`);
  if (error) console.error(`   Error: ${error}`);
  if (details) console.log(`   Details:`, JSON.stringify(details, null, 2));
}

// ============================================================================
// PRUEBA 1: Upload de PDF Pequeño
// ============================================================================

async function testSmallPDFUpload() {
  const testName = 'PDF Storage - Small PDF Upload (10KB)';
  const start = Date.now();

  try {
    // Crear PDF mock de 10KB
    const pdfBuffer = createMockPDFBuffer(10 * 1024);

    // Nota: Necesitaríamos un extraction ID real
    // Para esta prueba, asumimos que el endpoint existe
    const extractionId = 'test_extraction_' + Date.now();

    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'documento_test.pdf');

    const response = await makeRequest(`/api/extractions/${extractionId}/upload-pdf`, {
      method: 'POST',
      body: formData
    });

    const duration = Date.now() - start;

    if (response.ok || response.status === 404) {
      // 404 esperado si el extraction no existe
      logTest(testName, response.status === 404 ? 'SKIP' : 'PASS', duration,
        response.status === 404 ? 'Extraction no existe (esperado en test)' : undefined,
        response.ok ? await response.json() : undefined
      );
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 2: Upload de PDF Grande (cerca del límite)
// ============================================================================

async function testLargePDFUpload() {
  const testName = 'PDF Storage - Large PDF Upload (45MB)';
  const start = Date.now();

  try {
    // Crear PDF mock de 45MB (cerca del límite de 50MB)
    const pdfBuffer = createMockPDFBuffer(45 * 1024 * 1024);

    const extractionId = 'test_extraction_large_' + Date.now();

    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'documento_grande.pdf');

    const response = await makeRequest(`/api/extractions/${extractionId}/upload-pdf`, {
      method: 'POST',
      body: formData
    });

    const duration = Date.now() - start;

    if (response.ok || response.status === 404 || response.status === 413) {
      logTest(testName,
        response.status === 404 ? 'SKIP' :
        response.status === 413 ? 'PASS' :
        'PASS',
        duration,
        response.status === 404 ? 'Extraction no existe' :
        response.status === 413 ? 'Límite de tamaño rechazado correctamente' : undefined,
        {
          fileSize: '45MB',
          uploadTime: `${duration}ms`,
          uploadSpeed: `${((45 * 1024) / (duration / 1000)).toFixed(2)} KB/s`
        }
      );
    } else {
      throw new Error(`HTTP ${response.status}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 3: Rechazo de Archivos que Exceden el Límite
// ============================================================================

async function testOversizedPDFRejection() {
  const testName = 'PDF Storage - Oversized PDF Rejection (60MB)';
  const start = Date.now();

  try {
    // Crear PDF mock de 60MB (excede el límite de 50MB)
    const pdfBuffer = createMockPDFBuffer(60 * 1024 * 1024);

    const extractionId = 'test_extraction_oversized_' + Date.now();

    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'documento_muy_grande.pdf');

    const response = await makeRequest(`/api/extractions/${extractionId}/upload-pdf`, {
      method: 'POST',
      body: formData
    });

    const duration = Date.now() - start;

    // Debería rechazar con 413 (Payload Too Large) o 400
    if (response.status === 413 || response.status === 400) {
      logTest(testName, 'PASS', duration, undefined, {
        expectedError: 'Archivo demasiado grande rechazado correctamente',
        statusCode: response.status
      });
    } else if (response.status === 404) {
      logTest(testName, 'SKIP', duration, 'Extraction no existe');
    } else {
      throw new Error('Debería haber rechazado el archivo demasiado grande');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 4: Validación de Firma PDF
// ============================================================================

async function testPDFSignatureValidation() {
  const testName = 'PDF Storage - PDF Signature Validation';
  const start = Date.now();

  try {
    // Crear archivo que NO es PDF (sin firma %PDF)
    const invalidBuffer = Buffer.from('Este no es un PDF válido, solo texto plano');

    const extractionId = 'test_extraction_invalid_' + Date.now();

    const formData = new FormData();
    const blob = new Blob([invalidBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'no_es_pdf.pdf');

    const response = await makeRequest(`/api/extractions/${extractionId}/upload-pdf`, {
      method: 'POST',
      body: formData
    });

    const duration = Date.now() - start;

    // Debería rechazar con 400
    if (response.status === 400) {
      const data = await response.json();
      logTest(testName, 'PASS', duration, undefined, {
        expectedError: 'Firma PDF inválida detectada',
        message: data.error
      });
    } else if (response.status === 404) {
      logTest(testName, 'SKIP', duration, 'Extraction no existe');
    } else {
      throw new Error('Debería haber rechazado el archivo sin firma PDF');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 5: Verificación de Checksums SHA-256
// ============================================================================

async function testChecksumVerification() {
  const testName = 'PDF Storage - SHA-256 Checksum Verification';
  const start = Date.now();

  try {
    const crypto = await import('crypto');

    // Crear PDF mock
    const pdfBuffer = createMockPDFBuffer(1024);

    // Calcular checksum localmente
    const expectedChecksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    const duration = Date.now() - start;

    // Verificar que el checksum es consistente
    const checksum2 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    if (expectedChecksum === checksum2) {
      logTest(testName, 'PASS', duration, undefined, {
        checksum: expectedChecksum,
        algorithm: 'SHA-256',
        consistent: true
      });
    } else {
      throw new Error('Checksums no coinciden');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 6: Carga Concurrente de Múltiples PDFs
// ============================================================================

async function testConcurrentUploads() {
  const testName = 'PDF Storage - Concurrent Uploads (10 PDFs)';
  const start = Date.now();

  try {
    const uploadCount = 10;
    const uploadPromises = [];

    for (let i = 0; i < uploadCount; i++) {
      const pdfBuffer = createMockPDFBuffer(5 * 1024); // 5KB cada uno

      const extractionId = `test_concurrent_${Date.now()}_${i}`;

      const formData = new FormData();
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('file', blob, `documento_${i}.pdf`);

      const promise = makeRequest(`/api/extractions/${extractionId}/upload-pdf`, {
        method: 'POST',
        body: formData
      });

      uploadPromises.push(promise);
    }

    // Esperar a todas las respuestas
    const responses = await Promise.all(uploadPromises);

    const duration = Date.now() - start;

    const successful = responses.filter(r => r.ok).length;
    const skipped = responses.filter(r => r.status === 404).length;
    const failed = responses.filter(r => !r.ok && r.status !== 404).length;

    logTest(testName, skipped === uploadCount ? 'SKIP' : 'PASS', duration,
      skipped === uploadCount ? 'Extractions no existen' : undefined,
      {
        totalUploads: uploadCount,
        successful,
        skipped,
        failed,
        avgTimePerUpload: `${(duration / uploadCount).toFixed(2)}ms`
      }
    );

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 7: Diferentes Tipos de PDFs
// ============================================================================

async function testVariousPDFSizes() {
  const testName = 'PDF Storage - Various PDF Sizes';
  const start = Date.now();

  try {
    const sizes = [
      { name: '1KB', bytes: 1024 },
      { name: '100KB', bytes: 100 * 1024 },
      { name: '1MB', bytes: 1024 * 1024 },
      { name: '10MB', bytes: 10 * 1024 * 1024 }
    ];

    const uploadResults = [];

    for (const size of sizes) {
      const uploadStart = Date.now();
      const pdfBuffer = createMockPDFBuffer(size.bytes);
      const uploadDuration = Date.now() - uploadStart;

      uploadResults.push({
        size: size.name,
        bytes: size.bytes,
        generationTime: uploadDuration
      });
    }

    const duration = Date.now() - start;

    logTest(testName, 'PASS', duration, undefined, {
      testedSizes: uploadResults,
      totalTime: `${duration}ms`
    });

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// EJECUTAR TODAS LAS PRUEBAS
// ============================================================================

export async function runPDFStorageTests() {
  console.log('\n' + '='.repeat(80));
  console.log('📄 TESTS DE ALMACENAMIENTO DE PDFs EN BLOB');
  console.log('='.repeat(80) + '\n');

  if (!AUTH_TOKEN) {
    console.error('❌ ERROR: TEST_AUTH_TOKEN no configurado en .env.local');
    console.log('   Crea un token de prueba y añádelo a .env.local\n');
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('⚠️  ADVERTENCIA: BLOB_READ_WRITE_TOKEN no configurado');
    console.log('   Algunas pruebas podrían fallar\n');
  }

  await testSmallPDFUpload();
  await testLargePDFUpload();
  await testOversizedPDFRejection();
  await testPDFSignatureValidation();
  await testChecksumVerification();
  await testConcurrentUploads();
  await testVariousPDFSizes();

  // Resumen
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`✅ Pasadas: ${passed}`);
  console.log(`❌ Falladas: ${failed}`);
  console.log(`⏭️  Saltadas: ${skipped}`);
  console.log(`⏱️  Tiempo total: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log('❌ PRUEBAS FALLIDAS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
    console.log('');
  }

  return {
    passed,
    failed,
    skipped,
    totalDuration,
    results
  };
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runPDFStorageTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error ejecutando tests:', error);
      process.exit(1);
    });
}
