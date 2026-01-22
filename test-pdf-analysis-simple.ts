/**
 * Test simple del servicio de análisis de PDF
 */

import pkg from 'jspdf';
const { jsPDF } = pkg as any;

async function testBasic() {
  console.log('🧪 Test básico de PDF...\n');

  try {
    // Crear PDF simple con texto
    console.log('1. Creando PDF con jsPDF...');
    const doc = new jsPDF();
    doc.text('Hola mundo - Este es un PDF de prueba', 10, 10);
    doc.text('Número de documento: 12345', 10, 20);

    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    console.log(`✅ PDF creado: ${pdfBuffer.length} bytes`);
    console.log(`   Firma PDF: ${pdfBuffer.slice(0, 5).toString('ascii')}`);

    // Verificar que sea un PDF válido
    const isPDF = pdfBuffer.slice(0, 5).toString('ascii') === '%PDF-';
    console.log(`   ¿Es PDF válido? ${isPDF ? 'SÍ' : 'NO'}`);

    // Intentar importar pdfjs-dist
    console.log('\n2. Importando pdfjs-dist...');
    const pdfjsLib = await import('pdfjs-dist');
    console.log('✅ pdfjs-dist importado correctamente');
    console.log(`   Versión: ${pdfjsLib.version || 'desconocida'}`);

    // Intentar cargar el PDF
    console.log('\n3. Cargando PDF con pdfjs-dist...');
    const data = new Uint8Array(pdfBuffer);

    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    });

    console.log('   Loading task creado...');

    const pdfDocument = await loadingTask.promise;
    console.log(`✅ PDF cargado: ${pdfDocument.numPages} páginas`);

    // Extraer texto de la primera página
    console.log('\n4. Extrayendo texto de la primera página...');
    const page = await pdfDocument.getPage(1);
    console.log('✅ Página 1 obtenida');

    const textContent = await page.getTextContent();
    console.log(`✅ Contenido de texto extraído: ${textContent.items.length} items`);

    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .trim();

    console.log(`\n📄 Texto extraído: "${pageText}"`);
    console.log(`   Longitud: ${pageText.length} caracteres`);

    // Limpiar
    await pdfDocument.cleanup();
    await pdfDocument.destroy();

    console.log('\n✅ ¡ÉXITO! El sistema de análisis de PDF funciona correctamente.');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testBasic();
