/**
 * Script para Ejecutar Tests contra Producción
 *
 * Este script configura temporalmente la URL de producción y ejecuta todas las pruebas
 */

// Configurar URL de producción
process.env.NEXT_PUBLIC_API_URL = 'https://www.verbadocpro.eu';

import { runCrossValidationTests } from './cross-validation.test.js';
import { runPDFStorageTests } from './pdf-storage.test.js';
import { runBatchProcessingTests } from './batch-processing.test.js';
import { runExportTests } from './export.test.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

interface TestSuiteResult {
  suiteName: string;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  results?: any[];
}

const allResults: TestSuiteResult[] = [];

// ============================================================================
// HEADER
// ============================================================================

function printHeader() {
  console.log('\n' + '═'.repeat(80));
  console.log('         VERBADOCPRO - TESTS CONTRA SERVIDOR DE PRODUCCIÓN');
  console.log('═'.repeat(80));
  console.log('📋 Fecha:', new Date().toLocaleString('es-ES'));
  console.log('🌐 Servidor:', process.env.NEXT_PUBLIC_API_URL);
  console.log('🔧 Entorno: PRODUCCIÓN');
  console.log('═'.repeat(80) + '\n');
}

// ============================================================================
// EJECUTAR SUITE DE PRUEBAS
// ============================================================================

async function runTestSuite(
  name: string,
  testFunction: () => Promise<any>,
  emoji: string
) {
  console.log('═'.repeat(80));
  console.log(`${emoji} INICIANDO: ${name}`);
  console.log('═'.repeat(80) + '\n');

  const start = Date.now();

  try {
    const result = await testFunction();

    const duration = Date.now() - start;

    allResults.push({
      suiteName: name,
      passed: result?.passed || 0,
      failed: result?.failed || 0,
      skipped: result?.skipped || 0,
      totalDuration: result?.totalDuration || duration,
      results: result?.results
    });

    console.log(`\n✅ ${name} completado en ${duration}ms\n`);

  } catch (error: any) {
    const duration = Date.now() - start;

    console.error(`\n❌ ${name} falló:`, error.message);

    allResults.push({
      suiteName: name,
      passed: 0,
      failed: 1,
      skipped: 0,
      totalDuration: duration
    });
  }
}

// ============================================================================
// GENERAR REPORTE FINAL
// ============================================================================

function generateReport() {
  console.log('\n\n' + '═'.repeat(80));
  console.log('                📊 REPORTE FINAL - PRODUCCIÓN');
  console.log('═'.repeat(80) + '\n');

  // Tabla de resultados por suite
  console.log('Resultados por Suite:');
  console.log('─'.repeat(80));
  console.log('Suite'.padEnd(40) + 'Pasadas  Falladas  Saltadas  Tiempo');
  console.log('─'.repeat(80));

  for (const suite of allResults) {
    const name = suite.suiteName.substring(0, 39).padEnd(40);
    const passed = String(suite.passed).padStart(7);
    const failed = String(suite.failed).padStart(8);
    const skipped = String(suite.skipped).padStart(9);
    const time = `${suite.totalDuration}ms`.padStart(10);

    console.log(`${name}${passed}  ${failed}  ${skipped}  ${time}`);
  }

  console.log('─'.repeat(80));

  // Totales
  const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
  const totalSkipped = allResults.reduce((sum, r) => sum + r.skipped, 0);
  const totalDuration = allResults.reduce((sum, r) => sum + r.totalDuration, 0);
  const totalTests = totalPassed + totalFailed + totalSkipped;

  console.log('TOTALES'.padEnd(40) + String(totalPassed).padStart(7) + '  ' + String(totalFailed).padStart(8) + '  ' + String(totalSkipped).padStart(9) + '  ' + `${totalDuration}ms`.padStart(10));
  console.log('─'.repeat(80) + '\n');

  // Estadísticas
  const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0.00';

  console.log('Estadísticas Generales:');
  console.log('  🎯 Total de pruebas:', totalTests);
  console.log('  ✅ Pasadas:', totalPassed);
  console.log('  ❌ Falladas:', totalFailed);
  console.log('  ⏭️  Saltadas:', totalSkipped);
  console.log('  📈 Tasa de éxito:', `${successRate}%`);
  console.log('  ⏱️  Tiempo total:', `${(totalDuration / 1000).toFixed(2)}s`);
  console.log('  ⚡ Promedio por prueba:', `${(totalDuration / totalTests).toFixed(2)}ms`);
  console.log('');

  // Resultado final
  if (totalFailed === 0) {
    console.log('🎉 ¡TODAS LAS PRUEBAS PASARON EN PRODUCCIÓN!');
  } else {
    console.log('⚠️  ALGUNAS PRUEBAS FALLARON EN PRODUCCIÓN');
    console.log(`   ${totalFailed} prueba(s) necesitan atención\n`);

    // Listar suites con fallos
    const failedSuites = allResults.filter(r => r.failed > 0);
    if (failedSuites.length > 0) {
      console.log('Suites con fallos:');
      failedSuites.forEach(suite => {
        console.log(`   - ${suite.suiteName}: ${suite.failed} fallo(s)`);
      });
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');

  return {
    totalTests,
    totalPassed,
    totalFailed,
    totalSkipped,
    successRate: parseFloat(successRate),
    totalDuration,
    suites: allResults
  };
}

// ============================================================================
// GUARDAR REPORTE
// ============================================================================

function saveReportToFile(reportData: any) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(process.cwd(), 'tests', 'reports');
  const reportPath = path.join(reportDir, `production-test-report-${timestamp}.json`);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  console.log(`📄 Reporte guardado en: ${reportPath}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  printHeader();

  console.log('🚀 Ejecutando tests contra servidor de PRODUCCIÓN...\n');
  console.log(`   Servidor: ${process.env.NEXT_PUBLIC_API_URL}\n`);

  const startTime = Date.now();

  // Ejecutar todas las suites
  await runTestSuite('Excel Cross-Validation Tests', runCrossValidationTests, '🧪');
  await runTestSuite('PDF Storage Tests', runPDFStorageTests, '📄');
  await runTestSuite('Batch Processing Tests', runBatchProcessingTests, '⚙️');
  await runTestSuite('Export Tests', runExportTests, '📦');

  const totalTime = Date.now() - startTime;

  // Generar reporte
  const reportData = {
    ...generateReport(),
    timestamp: new Date().toISOString(),
    environment: 'production',
    server: process.env.NEXT_PUBLIC_API_URL,
    totalExecutionTime: totalTime
  };

  // Guardar reporte
  saveReportToFile(reportData);

  // Exit code
  const exitCode = reportData.totalFailed > 0 ? 1 : 0;

  console.log(`\n🏁 Suite completa finalizada en ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Exit code: ${exitCode}\n`);

  process.exit(exitCode);
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal en suite de pruebas:', error);
  process.exit(1);
});
