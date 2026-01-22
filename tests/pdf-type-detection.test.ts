/**
 * Tests para Detección de Tipo de PDF
 *
 * Prueba la funcionalidad de análisis automático de PDFs
 * para detectar si contienen texto (OCR) o solo imágenes
 */

import { analyzePDFFromBuffer, requiresOCR, getPDFTypeDescription } from '../src/services/pdfAnalysisService.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'jspdf';
const { jsPDF } = pkg as any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// HELPERS: GENERACIÓN DE PDFs DE PRUEBA
// ============================================================================

/**
 * Crear PDF con texto (simula PDF nativo o con OCR)
 */
function createPDFWithText(content: string): Buffer {
  const doc = new jsPDF();
  doc.text(content, 10, 10);
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Crear PDF vacío (simula PDF escaneado sin OCR)
 * Nota: Un PDF completamente vacío es difícil de simular,
 * así que creamos uno con contenido mínimo pero sin texto extraíble
 */
function createEmptyPDF(): Buffer {
  const doc = new jsPDF();
  // No añadir texto, solo crear el documento
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Crear PDF con múltiples páginas con texto
 */
function createMultiPagePDFWithText(pageCount: number): Buffer {
  const doc = new jsPDF();

  for (let i = 1; i <= pageCount; i++) {
    if (i > 1) {
      doc.addPage();
    }
    doc.text(`Página ${i} - Este es un PDF con texto en todas las páginas.`, 10, 10);
    doc.text(`Contenido adicional para simular un documento real.`, 10, 20);
    doc.text(`Número de identificación: ABC${i}23456`, 10, 30);
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

// ============================================================================
// TESTS
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Detectar PDF con texto (tipo OCR)
 */
async function testDetectPDFWithText() {
  console.log('\n📝 Test 1: Detectar PDF con texto...');

  try {
    const pdfContent = `
      IDENTIFICACIÓN DEL DOCUMENTO

      Número de documento: 12345678A
      Fecha de emisión: 15/03/2024
      Lugar: Madrid, España

      Este es un documento de prueba con texto extraíble.
      El sistema debería detectarlo como tipo 'ocr'.
    `;

    const pdfBuffer = createPDFWithText(pdfContent);
    const analysis = await analyzePDFFromBuffer(pdfBuffer);

    console.log('  Resultado del análisis:', {
      type: analysis.type,
      hasText: analysis.hasText,
      pageCount: analysis.pageCount,
      textPages: analysis.textPagesCount,
      confidence: analysis.confidence
    });

    const passed = analysis.type === 'ocr' && analysis.hasText === true;

    results.push({
      name: 'Test 1: Detectar PDF con texto',
      passed,
      details: {
        expected: 'ocr',
        received: analysis.type,
        hasText: analysis.hasText,
        confidence: analysis.confidence
      }
    });

    console.log(passed ? '  ✅ PASADO' : '  ❌ FALLIDO');

  } catch (error: any) {
    console.error('  ❌ ERROR:', error.message);
    results.push({
      name: 'Test 1: Detectar PDF con texto',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test 2: Detectar PDF sin texto (solo imágenes)
 */
async function testDetectPDFWithoutText() {
  console.log('\n📷 Test 2: Detectar PDF sin texto...');

  try {
    const pdfBuffer = createEmptyPDF();
    const analysis = await analyzePDFFromBuffer(pdfBuffer);

    console.log('  Resultado del análisis:', {
      type: analysis.type,
      hasText: analysis.hasText,
      pageCount: analysis.pageCount,
      textPages: analysis.textPagesCount
    });

    // Un PDF vacío debería tener type 'image' o al menos hasText = false
    const passed = analysis.hasText === false || analysis.type === 'image';

    results.push({
      name: 'Test 2: Detectar PDF sin texto',
      passed,
      details: {
        type: analysis.type,
        hasText: analysis.hasText,
        textPages: analysis.textPagesCount
      }
    });

    console.log(passed ? '  ✅ PASADO' : '  ❌ FALLIDO');

  } catch (error: any) {
    console.error('  ❌ ERROR:', error.message);
    results.push({
      name: 'Test 2: Detectar PDF sin texto',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test 3: PDF multipágina con texto
 */
async function testMultiPagePDF() {
  console.log('\n📚 Test 3: PDF multipágina con texto...');

  try {
    const pageCount = 5;
    const pdfBuffer = createMultiPagePDFWithText(pageCount);
    const analysis = await analyzePDFFromBuffer(pdfBuffer);

    console.log('  Resultado del análisis:', {
      type: analysis.type,
      pageCount: analysis.pageCount,
      textPages: analysis.textPagesCount,
      confidence: analysis.confidence
    });

    const passed =
      analysis.type === 'ocr' &&
      analysis.pageCount === pageCount &&
      analysis.textPagesCount === pageCount;

    results.push({
      name: 'Test 3: PDF multipágina',
      passed,
      details: {
        expectedPages: pageCount,
        detectedPages: analysis.pageCount,
        textPages: analysis.textPagesCount,
        type: analysis.type
      }
    });

    console.log(passed ? '  ✅ PASADO' : '  ❌ FALLIDO');

  } catch (error: any) {
    console.error('  ❌ ERROR:', error.message);
    results.push({
      name: 'Test 3: PDF multipágina',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test 4: Función requiresOCR
 */
async function testRequiresOCR() {
  console.log('\n🔍 Test 4: Función requiresOCR...');

  try {
    // PDF con texto no requiere OCR
    const pdfWithText = createPDFWithText('Texto de prueba');
    const analysisWithText = await analyzePDFFromBuffer(pdfWithText);
    const needsOCR1 = requiresOCR(analysisWithText);

    // PDF sin texto requiere OCR
    const pdfWithoutText = createEmptyPDF();
    const analysisWithoutText = await analyzePDFFromBuffer(pdfWithoutText);
    const needsOCR2 = requiresOCR(analysisWithoutText);

    console.log('  PDF con texto requiere OCR:', needsOCR1);
    console.log('  PDF sin texto requiere OCR:', needsOCR2);

    const passed = needsOCR1 === false && needsOCR2 === true;

    results.push({
      name: 'Test 4: Función requiresOCR',
      passed,
      details: {
        withTextNeedsOCR: needsOCR1,
        withoutTextNeedsOCR: needsOCR2
      }
    });

    console.log(passed ? '  ✅ PASADO' : '  ❌ FALLIDO');

  } catch (error: any) {
    console.error('  ❌ ERROR:', error.message);
    results.push({
      name: 'Test 4: Función requiresOCR',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test 5: Función getPDFTypeDescription
 */
function testGetPDFTypeDescription() {
  console.log('\n📖 Test 5: Descripciones de tipo de PDF...');

  try {
    const descOCR_ES = getPDFTypeDescription('ocr', 'es');
    const descImage_ES = getPDFTypeDescription('image', 'es');
    const descMixed_ES = getPDFTypeDescription('mixed', 'es');

    const descOCR_EN = getPDFTypeDescription('ocr', 'en');
    const descImage_EN = getPDFTypeDescription('image', 'en');

    console.log('  OCR (ES):', descOCR_ES);
    console.log('  Image (ES):', descImage_ES);
    console.log('  Mixed (ES):', descMixed_ES);
    console.log('  OCR (EN):', descOCR_EN);
    console.log('  Image (EN):', descImage_EN);

    const passed =
      descOCR_ES.length > 0 &&
      descImage_ES.length > 0 &&
      descMixed_ES.length > 0 &&
      descOCR_EN.length > 0 &&
      descImage_EN.length > 0;

    results.push({
      name: 'Test 5: Descripciones de tipo',
      passed,
      details: {
        spanish: { ocr: descOCR_ES, image: descImage_ES, mixed: descMixed_ES },
        english: { ocr: descOCR_EN, image: descImage_EN }
      }
    });

    console.log(passed ? '  ✅ PASADO' : '  ❌ FALLIDO');

  } catch (error: any) {
    console.error('  ❌ ERROR:', error.message);
    results.push({
      name: 'Test 5: Descripciones de tipo',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test 6: Validar análisis de muestra de texto
 */
async function testTextSample() {
  console.log('\n📄 Test 6: Extracción de muestra de texto...');

  try {
    const testText = 'Este es un texto de prueba para verificar la extracción de muestra.';
    const pdfBuffer = createPDFWithText(testText);
    const analysis = await analyzePDFFromBuffer(pdfBuffer);

    console.log('  Muestra extraída:', analysis.textContentSample?.substring(0, 100));

    const passed = analysis.textContentSample && analysis.textContentSample.length > 0;

    results.push({
      name: 'Test 6: Muestra de texto',
      passed,
      details: {
        hasSample: !!analysis.textContentSample,
        sampleLength: analysis.textContentSample?.length || 0,
        sample: analysis.textContentSample?.substring(0, 50)
      }
    });

    console.log(passed ? '  ✅ PASADO' : '  ❌ FALLIDO');

  } catch (error: any) {
    console.error('  ❌ ERROR:', error.message);
    results.push({
      name: 'Test 6: Muestra de texto',
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test 7: Confianza en detección
 */
async function testDetectionConfidence() {
  console.log('\n🎯 Test 7: Nivel de confianza en detección...');

  try {
    const pdfBuffer = createMultiPagePDFWithText(3);
    const analysis = await analyzePDFFromBuffer(pdfBuffer);

    console.log('  Nivel de confianza:', analysis.confidence);
    console.log('  Detalles:', analysis.details);

    const validConfidenceLevels = ['high', 'medium', 'low'];
    const passed = validConfidenceLevels.includes(analysis.confidence);

    results.push({
      name: 'Test 7: Confianza en detección',
      passed,
      details: {
        confidence: analysis.confidence,
        details: analysis.details
      }
    });

    console.log(passed ? '  ✅ PASADO' : '  ❌ FALLIDO');

  } catch (error: any) {
    console.error('  ❌ ERROR:', error.message);
    results.push({
      name: 'Test 7: Confianza en detección',
      passed: false,
      error: error.message
    });
  }
}

// ============================================================================
// EJECUTAR TESTS
// ============================================================================

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 INICIANDO TESTS DE DETECCIÓN DE TIPO DE PDF');
  console.log('═══════════════════════════════════════════════════════');

  await testDetectPDFWithText();
  await testDetectPDFWithoutText();
  await testMultiPagePDF();
  await testRequiresOCR();
  testGetPDFTypeDescription();
  await testTextSample();
  await testDetectionConfidence();

  // Resumen
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DE TESTS');
  console.log('═══════════════════════════════════════════════════════');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\nTotal: ${total} tests`);
  console.log(`✅ Pasados: ${passed}`);
  console.log(`❌ Fallidos: ${failed}`);
  console.log(`📈 Porcentaje: ${((passed / total) * 100).toFixed(1)}%`);

  console.log('\n📋 Detalle de resultados:');
  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n═══════════════════════════════════════════════════════');

  // Guardar reporte JSON
  const reportPath = path.join(__dirname, 'reports', 'pdf-type-detection-results.json');
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      percentage: (passed / total) * 100
    },
    results
  }, null, 2));

  console.log(`\n💾 Reporte guardado en: ${reportPath}`);

  // Exit code según resultado
  process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar si es el módulo principal
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runAllTests().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

export { runAllTests };
