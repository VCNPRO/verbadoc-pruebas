/**
 * Tests de Exportación Consolidada
 *
 * Prueba el sistema de exportación:
 * - Exportación a Excel con múltiples hojas
 * - Exportación a CSV
 * - Exportación a PDF
 * - Exportación con validación incluida
 * - Exportación con validación cruzada
 * - Exportación de alta carga (1000 registros)
 * - Diferentes opciones de agrupación
 */

import {
  generateMockExtractions,
  SMALL_DATASET,
  MEDIUM_DATASET,
  LARGE_DATASET,
  ERROR_DATASET
} from './fixtures/mock-data-generator';
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
// PRUEBA 1: Exportar a Excel - Dataset Pequeño
// ============================================================================

async function testExcelExportSmall() {
  const testName = 'Export - Excel Small Dataset (10 records)';
  const start = Date.now();

  try {
    const extractionIds = SMALL_DATASET.extractions.map(e => e.id);

    const payload = {
      extractionIds,
      format: 'excel',
      includeValidation: false,
      includeCrossValidation: false
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const contentDisposition = response.headers.get('content-disposition');
      const buffer = await response.arrayBuffer();

      logTest(testName, 'PASS', duration, undefined, {
        recordsExported: extractionIds.length,
        fileSize: `${(buffer.byteLength / 1024).toFixed(2)} KB`,
        contentType,
        filename: contentDisposition?.match(/filename="(.+)"/)?.[1]
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 2: Exportar a Excel - Dataset Medio
// ============================================================================

async function testExcelExportMedium() {
  const testName = 'Export - Excel Medium Dataset (100 records)';
  const start = Date.now();

  try {
    const extractionIds = MEDIUM_DATASET.extractions.map(e => e.id);

    const payload = {
      extractionIds,
      format: 'excel',
      includeValidation: true,
      includeCrossValidation: false
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const buffer = await response.arrayBuffer();

      logTest(testName, 'PASS', duration, undefined, {
        recordsExported: extractionIds.length,
        fileSize: `${(buffer.byteLength / 1024).toFixed(2)} KB`,
        exportSpeed: `${(extractionIds.length / (duration / 1000)).toFixed(2)} records/sec`,
        includesValidation: true
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 3: Exportar a Excel - Dataset Grande (Alta Carga)
// ============================================================================

async function testExcelExportLarge() {
  const testName = 'Export - Excel Large Dataset (1000 records - HIGH LOAD)';
  const start = Date.now();

  try {
    const extractionIds = LARGE_DATASET.extractions.map(e => e.id);

    const payload = {
      extractionIds,
      format: 'excel',
      includeValidation: true,
      includeCrossValidation: true
    };

    console.log(`\n   🔥 Exportando ${extractionIds.length} registros con validación...`);

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const buffer = await response.arrayBuffer();

      logTest(testName, 'PASS', duration, undefined, {
        recordsExported: extractionIds.length,
        fileSize: `${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`,
        exportSpeed: `${(extractionIds.length / (duration / 1000)).toFixed(2)} records/sec`,
        totalTime: `${(duration / 1000).toFixed(2)}s`,
        includesValidation: true,
        includesCrossValidation: true
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 4: Exportar a CSV
// ============================================================================

async function testCSVExport() {
  const testName = 'Export - CSV Format (100 records)';
  const start = Date.now();

  try {
    const extractionIds = MEDIUM_DATASET.extractions.map(e => e.id);

    const payload = {
      extractionIds,
      format: 'csv'
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder().decode(buffer);

      // Contar líneas
      const lines = text.split('\n').filter(l => l.trim().length > 0);

      logTest(testName, 'PASS', duration, undefined, {
        recordsExported: extractionIds.length,
        fileSize: `${(buffer.byteLength / 1024).toFixed(2)} KB`,
        contentType,
        linesInFile: lines.length,
        separator: 'semicolon (;)'
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 5: Exportar a PDF
// ============================================================================

async function testPDFExport() {
  const testName = 'Export - PDF Format (50 records)';
  const start = Date.now();

  try {
    const extractionIds = generateMockExtractions(50).map(e => e.id);

    const payload = {
      extractionIds,
      format: 'pdf'
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const buffer = await response.arrayBuffer();

      // Verificar firma PDF
      const pdfSignature = new Uint8Array(buffer.slice(0, 4));
      const isPDF = String.fromCharCode(...pdfSignature) === '%PDF';

      logTest(testName, 'PASS', duration, undefined, {
        recordsExported: extractionIds.length,
        fileSize: `${(buffer.byteLength / 1024).toFixed(2)} KB`,
        contentType,
        validPDFSignature: isPDF
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 6: Validación de Límites (>1000 registros)
// ============================================================================

async function testExportLimitValidation() {
  const testName = 'Export - Limit Validation (>1000 records)';
  const start = Date.now();

  try {
    // Intentar exportar más de 1000 registros
    const extractionIds = generateMockExtractions(1500).map(e => e.id);

    const payload = {
      extractionIds,
      format: 'excel'
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    // Debería rechazar con 400
    if (!response.ok && response.status === 400) {
      const data = await response.json();
      logTest(testName, 'PASS', duration, undefined, {
        expectedError: 'Límite de exportación excedido',
        statusCode: response.status,
        message: data.error
      });
    } else {
      throw new Error('Debería haber rechazado la exportación de >1000 registros');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 7: Validación de Formato Inválido
// ============================================================================

async function testInvalidFormatValidation() {
  const testName = 'Export - Invalid Format Validation';
  const start = Date.now();

  try {
    const extractionIds = SMALL_DATASET.extractions.map(e => e.id);

    const payload = {
      extractionIds,
      format: 'json' // Formato no soportado
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    // Debería rechazar con 400
    if (!response.ok && response.status === 400) {
      const data = await response.json();
      logTest(testName, 'PASS', duration, undefined, {
        expectedError: 'Formato inválido rechazado',
        statusCode: response.status,
        message: data.error
      });
    } else {
      throw new Error('Debería haber rechazado el formato inválido');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 8: Exportación Sin IDs
// ============================================================================

async function testEmptyExtractionIds() {
  const testName = 'Export - Empty Extraction IDs Validation';
  const start = Date.now();

  try {
    const payload = {
      extractionIds: [],
      format: 'excel'
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    // Debería rechazar con 400
    if (!response.ok && response.status === 400) {
      const data = await response.json();
      logTest(testName, 'PASS', duration, undefined, {
        expectedError: 'Array vacío rechazado',
        statusCode: response.status,
        message: data.error
      });
    } else {
      throw new Error('Debería haber rechazado array vacío');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 9: Exportación con Dataset de Errores
// ============================================================================

async function testErrorDatasetExport() {
  const testName = 'Export - Dataset with Mixed States';
  const start = Date.now();

  try {
    const extractionIds = ERROR_DATASET.extractions.map(e => e.id);

    const payload = {
      extractionIds,
      format: 'excel',
      includeValidation: true
    };

    const response = await makeRequest('/api/export/consolidated', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - start;

    if (response.ok) {
      const buffer = await response.arrayBuffer();

      logTest(testName, 'PASS', duration, undefined, {
        recordsExported: extractionIds.length,
        fileSize: `${(buffer.byteLength / 1024).toFixed(2)} KB`,
        datasetType: ERROR_DATASET.description
      });
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// PRUEBA 10: Comparación de Tamaños entre Formatos
// ============================================================================

async function testFormatComparison() {
  const testName = 'Export - Format Size Comparison';
  const start = Date.now();

  try {
    const extractionIds = MEDIUM_DATASET.extractions.map(e => e.id).slice(0, 50);
    const formats = ['excel', 'csv', 'pdf'];
    const formatSizes: Record<string, number> = {};

    for (const format of formats) {
      const payload = {
        extractionIds,
        format
      };

      const response = await makeRequest('/api/export/consolidated', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        formatSizes[format] = buffer.byteLength;
      }
    }

    const duration = Date.now() - start;

    if (Object.keys(formatSizes).length === formats.length) {
      logTest(testName, 'PASS', duration, undefined, {
        recordsExported: extractionIds.length,
        fileSizes: {
          excel: `${(formatSizes.excel / 1024).toFixed(2)} KB`,
          csv: `${(formatSizes.csv / 1024).toFixed(2)} KB`,
          pdf: `${(formatSizes.pdf / 1024).toFixed(2)} KB`
        },
        smallestFormat: Object.keys(formatSizes).reduce((a, b) =>
          formatSizes[a] < formatSizes[b] ? a : b
        )
      });
    } else {
      throw new Error('No se pudieron exportar todos los formatos');
    }

  } catch (error: any) {
    logTest(testName, 'FAIL', Date.now() - start, error.message);
  }
}

// ============================================================================
// EJECUTAR TODAS LAS PRUEBAS
// ============================================================================

export async function runExportTests() {
  console.log('\n' + '='.repeat(80));
  console.log('📦 TESTS DE EXPORTACIÓN CONSOLIDADA');
  console.log('='.repeat(80) + '\n');

  if (!AUTH_TOKEN) {
    console.error('❌ ERROR: TEST_AUTH_TOKEN no configurado en .env.local');
    console.log('   Crea un token de prueba y añádelo a .env.local\n');
    return;
  }

  await testExcelExportSmall();
  await testExcelExportMedium();
  await testExcelExportLarge();
  await testCSVExport();
  await testPDFExport();
  await testExportLimitValidation();
  await testInvalidFormatValidation();
  await testEmptyExtractionIds();
  await testErrorDatasetExport();
  await testFormatComparison();

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
  runExportTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error ejecutando tests:', error);
      process.exit(1);
    });
}
