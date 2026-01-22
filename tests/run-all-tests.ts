/**
 * Script Principal de Testing
 *
 * Ejecuta todas las pruebas de VerbadocPro:
 * - Excel Cross-Validation Tests
 * - PDF Storage Tests
 * - Batch Processing Tests (incluye alta carga)
 * - Export Tests (todos los formatos)
 *
 * Genera un reporte completo al final
 */

import { runCrossValidationTests } from './cross-validation.test';
import { runPDFStorageTests } from './pdf-storage.test';
import { runBatchProcessingTests } from './batch-processing.test';
import { runExportTests } from './export.test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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
  console.log('                  VERBADOCPRO - SUITE COMPLETA DE PRUEBAS');
  console.log('═'.repeat(80));
  console.log('📋 Fecha:', new Date().toLocaleString('es-ES'));
  console.log('🔧 Entorno:', process.env.NODE_ENV || 'development');
  console.log('🌐 API Base:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
  console.log('═'.repeat(80) + '\n');
}

// ============================================================================
// VERIFICAR CONFIGURACIÓN
// ============================================================================

function checkConfiguration() {
  console.log('🔍 Verificando configuración...\n');

  const checks = [
    {
      name: 'TEST_AUTH_TOKEN',
      value: process.env.TEST_AUTH_TOKEN,
      required: true
    },
    {
      name: 'POSTGRES_URL',
      value: process.env.POSTGRES_URL,
      required: true
    },
    {
      name: 'BLOB_READ_WRITE_TOKEN',
      value: process.env.BLOB_READ_WRITE_TOKEN,
      required: false
    },
    {
      name: 'JWT_SECRET',
      value: process.env.JWT_SECRET,
      required: true
    },
    {
      name: 'GOOGLE_VERTEX_PROJECT_ID',
      value: process.env.GOOGLE_VERTEX_PROJECT_ID,
      required: false
    }
  ];

  let hasErrors = false;

  for (const check of checks) {
    const status = check.value ? '✅' : (check.required ? '❌' : '⚠️');
    const label = check.required ? 'REQUERIDO' : 'OPCIONAL';

    console.log(`${status} ${check.name.padEnd(30)} [${label}] ${check.value ? '(configurado)' : '(no configurado)'}`);

    if (check.required && !check.value) {
      hasErrors = true;
    }
  }

  console.log('');

  if (hasErrors) {
    console.error('❌ ERROR: Faltan variables de entorno requeridas');
    console.log('   Por favor configura las variables faltantes en .env.local\n');
    process.exit(1);
  }

  console.log('✅ Configuración OK\n');
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
    console.error(error.stack);

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
  console.log('                         📊 REPORTE FINAL DE PRUEBAS');
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
    console.log('🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
  } else {
    console.log('⚠️  ALGUNAS PRUEBAS FALLARON');
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
// GUARDAR REPORTE EN ARCHIVO
// ============================================================================

function saveReportToFile(reportData: any) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(process.cwd(), 'tests', 'reports');
  const reportPath = path.join(reportDir, `test-report-${timestamp}.json`);

  // Crear directorio si no existe
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Guardar reporte JSON
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  console.log(`📄 Reporte guardado en: ${reportPath}\n`);

  // También guardar un reporte markdown
  const mdPath = path.join(reportDir, `test-report-${timestamp}.md`);
  const markdown = generateMarkdownReport(reportData);
  fs.writeFileSync(mdPath, markdown);

  console.log(`📝 Reporte Markdown guardado en: ${mdPath}\n`);
}

// ============================================================================
// GENERAR REPORTE MARKDOWN
// ============================================================================

function generateMarkdownReport(reportData: any): string {
  const md: string[] = [];

  md.push('# VerbadocPro - Reporte de Pruebas\n');
  md.push(`**Fecha:** ${new Date().toLocaleString('es-ES')}\n`);
  md.push(`**Entorno:** ${process.env.NODE_ENV || 'development'}\n`);
  md.push(`**Duración Total:** ${(reportData.totalDuration / 1000).toFixed(2)}s\n`);
  md.push(`**Tasa de Éxito:** ${reportData.successRate}%\n`);
  md.push('');

  md.push('## Resumen\n');
  md.push(`- ✅ **Pasadas:** ${reportData.totalPassed}`);
  md.push(`- ❌ **Falladas:** ${reportData.totalFailed}`);
  md.push(`- ⏭️ **Saltadas:** ${reportData.totalSkipped}`);
  md.push(`- 🎯 **Total:** ${reportData.totalTests}\n`);

  md.push('## Resultados por Suite\n');
  md.push('| Suite | Pasadas | Falladas | Saltadas | Tiempo |');
  md.push('|-------|---------|----------|----------|--------|');

  for (const suite of reportData.suites) {
    md.push(`| ${suite.suiteName} | ${suite.passed} | ${suite.failed} | ${suite.skipped} | ${suite.totalDuration}ms |`);
  }

  md.push('');

  if (reportData.totalFailed > 0) {
    md.push('## ⚠️ Pruebas Fallidas\n');
    const failedSuites = reportData.suites.filter((r: any) => r.failed > 0);
    for (const suite of failedSuites) {
      md.push(`### ${suite.suiteName}\n`);
      if (suite.results) {
        const failedTests = suite.results.filter((t: any) => t.status === 'FAIL');
        for (const test of failedTests) {
          md.push(`- **${test.name}**`);
          md.push(`  - Error: \`${test.error}\``);
          md.push('');
        }
      }
    }
  } else {
    md.push('## 🎉 ¡Todas las pruebas pasaron exitosamente!\n');
  }

  return md.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  printHeader();
  checkConfiguration();

  console.log('🚀 Iniciando suite completa de pruebas...\n');
  console.log('   Esta suite incluirá pruebas de:');
  console.log('   - Validación cruzada con Excel');
  console.log('   - Almacenamiento de PDFs en Blob');
  console.log('   - Procesamiento Batch (incluye alta carga)');
  console.log('   - Exportación consolidada (Excel, CSV, PDF)\n');

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
    environment: process.env.NODE_ENV || 'development',
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
