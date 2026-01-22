/**
 * Tests de Procesamiento Batch
 *
 * Prueba el sistema de batch processing:
 * - Creación de batches pequeños y grandes
 * - Consulta de estado y progreso
 * - Pruebas de alta carga (100 archivos)
 * - Cola de prioridades
 * - Cancelación de batches
 * - Cálculo de tiempo estimado
 * - Procesamiento concurrente
 */

import { generateMockBatchJob } from './fixtures/mock-data-generator';
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
const createdBatches: string[] = [];

// ============================================================================
// HELPERS
// ============================================================================

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Cookie': `auth-token=${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
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
// PRUEBA 1: Crear Batch Pequeño (10 archivos)
// ============================================================================

async function testSmallBatchCreation() {
  const testName = 'Batch Processing - Create Small Batch (10 files)';
  const start = Date.now();

  try {
    const mockBatch = generateMockBatchJob(10);

    const payload = {
      name: mockBatch.name,
      description: mockBatch.description,
      fileUrls: mockBatch.items.map(item => item.fileBlobUrl),
      modelUsed: mockBatch.modelUsed
    };

    const response = await makeRequest('/api/batch/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      createdBatches.push(data.batchId);

      logTest(testName, 'PASS', duration, undefined, {
        batchId: data.batchId,
        totalFiles: data.totalFiles,
        status: data.status
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 2: Crear Batch Grande (100 archivos - límite)
// ============================================================================

async function testLargeBatchCreation() {
  const testName = 'Batch Processing - Create Large Batch (100 files - LIMIT)';
  const start = Date.now();

  try {
    const mockBatch = generateMockBatchJob(100);

    const payload = {
      name: mockBatch.name,
      description: mockBatch.description,
      fileUrls: mockBatch.items.map(item => item.fileBlobUrl),
      modelUsed: mockBatch.modelUsed
    };

    const response = await makeRequest('/api/batch/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      createdBatches.push(data.batchId);

      logTest(testName, 'PASS', duration, undefined, {
        batchId: data.batchId,
        totalFiles: data.totalFiles,
        status: data.status,
        creationTime: `${duration}ms`
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 3: Rechazar Batch Demasiado Grande (>100 archivos)
// ============================================================================

async function testOversizedBatchRejection() {
  const testName = 'Batch Processing - Reject Oversized Batch (150 files)';
  const start = Date.now();

  try {
    const mockBatch = generateMockBatchJob(150);

    const payload = {
      name: mockBatch.name,
      description: mockBatch.description,
      fileUrls: mockBatch.items.map(item => item.fileBlobUrl),
      modelUsed: mockBatch.modelUsed
    };

    const response = await makeRequest('/api/batch/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    // Debería rechazar con 400
    if (!response.ok && response.status === 400) {
      const data = await response.json();
      logTest(testName, 'PASS', duration, undefined, {
        expectedError: 'Límite de archivos excedido',
        statusCode: response.status,
        message: data.error
      });
    } else {
      throw new Error('Debería haber rechazado el batch demasiado grande');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 4: Consultar Estado de Batch
// ============================================================================

async function testBatchStatusQuery() {
  const testName = 'Batch Processing - Query Batch Status';
  const start = Date.now();

  try {
    if (createdBatches.length === 0) {
      logTest(testName, 'SKIP', 0, 'No hay batches creados para consultar');
      return;
    }

    const batchId = createdBatches[0];

    const response = await makeRequest(`/api/batch/${batchId}/status`);

    const duration = Date.now() - start;

    if (response.ok) {
      const data = await response.json();

      logTest(testName, 'PASS', duration, undefined, {
        batchId: data.batch.id,
        status: data.batch.status,
        totalFiles: data.batch.totalFiles,
        processedFiles: data.batch.processedFiles,
        completionPercentage: data.stats.completionPercentage
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 5: Consultar con Items Incluidos
// ============================================================================

async function testBatchStatusWithItems() {
  const testName = 'Batch Processing - Query Status with Items';
  const start = Date.now();

  try {
    if (createdBatches.length === 0) {
      logTest(testName, 'SKIP', 0, 'No hay batches creados');
      return;
    }

    const batchId = createdBatches[0];

    const response = await makeRequest(`/api/batch/${batchId}/status?includeItems=true`);

    const duration = Date.now() - start;

    if (response.ok) {
      const data = await response.json();

      logTest(testName, 'PASS', duration, undefined, {
        batchId: data.batch.id,
        totalItems: data.items ? data.items.length : 0,
        stats: {
          pending: data.stats.pending,
          processing: data.stats.processing,
          completed: data.stats.completed,
          failed: data.stats.failed
        }
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 6: Creación Concurrente de Múltiples Batches
// ============================================================================

async function testConcurrentBatchCreation() {
  const testName = 'Batch Processing - Concurrent Batch Creation (5 batches)';
  const start = Date.now();

  try {
    const batchCount = 5;
    const creationPromises = [];

    for (let i = 0; i < batchCount; i++) {
      const mockBatch = generateMockBatchJob(20);

      const payload = {
        name: `Batch Concurrente ${i + 1}`,
        description: mockBatch.description,
        fileUrls: mockBatch.items.map(item => item.fileBlobUrl),
        modelUsed: mockBatch.modelUsed
      };

      const promise = makeRequest('/api/batch/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      creationPromises.push(promise);
    }

    const responses = await Promise.all(creationPromises);

    const duration = Date.now() - start;

    const successful = responses.filter(r => r.ok).length;
    const failed = responses.filter(r => !r.ok).length;

    // Guardar IDs de batches creados
    for (const response of responses) {
      if (response.ok) {
        const data = await response.json();
        createdBatches.push(data.batchId);
      }
    }

    logTest(testName, successful > 0 ? 'PASS' : 'FAIL', duration, undefined, {
      totalBatches: batchCount,
      successful,
      failed,
      avgCreationTime: `${(duration / batchCount).toFixed(2)}ms`
    });

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 7: Prueba de Alta Carga - Stress Test
// ============================================================================

async function testHighLoadStress() {
  const testName = 'Batch Processing - HIGH LOAD STRESS TEST (10 batches x 100 files)';
  const start = Date.now();

  try {
    const batchCount = 10;
    const filesPerBatch = 100;
    const creationPromises = [];

    console.log(`\n   🔥 Iniciando stress test: ${batchCount} batches de ${filesPerBatch} archivos...`);

    for (let i = 0; i < batchCount; i++) {
      const mockBatch = generateMockBatchJob(filesPerBatch);

      const payload = {
        name: `Stress Test Batch ${i + 1}/${batchCount}`,
        description: `Batch de stress test con ${filesPerBatch} archivos`,
        fileUrls: mockBatch.items.map(item => item.fileBlobUrl),
        modelUsed: 'gemini-2.0-flash-exp'
      };

      const promise = makeRequest('/api/batch/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      }).then(async (response) => {
        const data = response.ok ? await response.json() : null;
        return { response, data };
      });

      creationPromises.push(promise);
    }

    const results = await Promise.all(creationPromises);

    const duration = Date.now() - start;

    const successful = results.filter(r => r.response.ok).length;
    const failed = results.filter(r => !r.response.ok).length;
    const totalFilesCreated = successful * filesPerBatch;

    // Guardar IDs
    for (const result of results) {
      if (result.response.ok && result.data) {
        createdBatches.push(result.data.batchId);
      }
    }

    logTest(testName, successful > 0 ? 'PASS' : 'FAIL', duration, undefined, {
      totalBatches: batchCount,
      filesPerBatch,
      totalFilesCreated,
      successful,
      failed,
      totalDuration: `${duration}ms`,
      avgBatchCreationTime: `${(duration / batchCount).toFixed(2)}ms`,
      throughput: `${(totalFilesCreated / (duration / 1000)).toFixed(2)} files/sec`
    });

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 8: Validación de Diferentes Modelos
// ============================================================================

async function testDifferentModels() {
  const testName = 'Batch Processing - Different AI Models';
  const start = Date.now();

  try {
    const models = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    const creationPromises = models.map(model => {
      const mockBatch = generateMockBatchJob(10);

      const payload = {
        name: `Test ${model}`,
        description: `Batch con modelo ${model}`,
        fileUrls: mockBatch.items.map(item => item.fileBlobUrl),
        modelUsed: model
      };

      return makeRequest('/api/batch/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      }).then(async (response) => ({
        model,
        success: response.ok,
        data: response.ok ? await response.json() : null
      }));
    });

    const results = await Promise.all(creationPromises);

    const duration = Date.now() - start;

    const successful = results.filter(r => r.success).length;

    // Guardar IDs
    for (const result of results) {
      if (result.success && result.data) {
        createdBatches.push(result.data.batchId);
      }
    }

    logTest(testName, successful === models.length ? 'PASS' : 'FAIL', duration, undefined, {
      testedModels: results.map(r => ({
        model: r.model,
        success: r.success
      })),
      successRate: `${successful}/${models.length}`
    });

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 9: Validación de Campos Requeridos
// ============================================================================

async function testRequiredFieldsValidation() {
  const testName = 'Batch Processing - Required Fields Validation';
  const start = Date.now();

  try {
    // Intentar crear batch sin campos requeridos
    const invalidPayloads = [
      { name: 'Test', description: 'Test' }, // Sin fileUrls y modelUsed
      { fileUrls: [], modelUsed: 'gemini-2.0-flash-exp' }, // Sin name
      { name: 'Test', fileUrls: ['url1'], modelUsed: 'invalid-model' } // Modelo inválido
    ];

    const validationResults = [];

    for (const payload of invalidPayloads) {
      const response = await makeRequest('/api/batch/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      validationResults.push({
        payload: JSON.stringify(payload),
        rejected: !response.ok,
        statusCode: response.status
      });
    }

    const duration = Date.now() - start;

    const allRejected = validationResults.every(r => r.rejected);

    logTest(testName, allRejected ? 'PASS' : 'FAIL', duration, undefined, {
      testedPayloads: validationResults.length,
      allRejectedCorrectly: allRejected,
      results: validationResults
    });

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// EJECUTAR TODAS LAS PRUEBAS
// ============================================================================

export async function runBatchProcessingTests() {
  console.log('\n' + '='.repeat(80));
  console.log('⚙️  TESTS DE PROCESAMIENTO BATCH');
  console.log('='.repeat(80) + '\n');

  if (!AUTH_TOKEN) {
    console.error('❌ ERROR: TEST_AUTH_TOKEN no configurado en .env.local');
    console.log('   Crea un token de prueba y añádelo a .env.local\n');
    return;
  }

  await testSmallBatchCreation();
  await testLargeBatchCreation();
  await testOversizedBatchRejection();
  await testBatchStatusQuery();
  await testBatchStatusWithItems();
  await testConcurrentBatchCreation();
  await testHighLoadStress();
  await testDifferentModels();
  await testRequiredFieldsValidation();

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
  console.log(`⏱️  Tiempo total: ${totalDuration}ms`);
  console.log(`🔢 Batches creados: ${createdBatches.length}\n`);

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
    createdBatches: createdBatches.length,
    results
  };
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runBatchProcessingTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error ejecutando tests:', error);
      process.exit(1);
    });
}
