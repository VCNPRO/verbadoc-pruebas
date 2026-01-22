import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(__dirname, '..', 'google-credentials.json');

const visionClient = new ImageAnnotatorClient();
const storageClient = new Storage();

const GCS_BUCKET_NAME = 'verbadocpro-ocr-pdfs-vcnpro';

async function detectTextInPdfFromGCS(pdfLocalPath: string, outputJsonLocalPath: string) {
  console.log(`Procesando PDF: ${pdfLocalPath} a través de GCS.`);

  const bucket = storageClient.bucket(GCS_BUCKET_NAME);
  const fileName = path.basename(pdfLocalPath);
  const gcsInputUri = `gs://${GCS_BUCKET_NAME}/${fileName}`;
  const gcsOutputPrefix = `ocr_output/`; // Prefijo donde se guardarán los resultados

  console.log(`Subiendo ${pdfLocalPath} a ${gcsInputUri}...`);
  await bucket.upload(pdfLocalPath, { destination: fileName });
  console.log(`PDF subido. Iniciando procesamiento OCR...`);

  const inputConfig = {
    mimeType: 'application/pdf',
    gcsSource: { uri: gcsInputUri },
  };

  const outputConfig = {
    gcsDestination: { uri: `gs://${GCS_BUCKET_NAME}/${gcsOutputPrefix}` },
    batchSize: 20, // Puedes ajustar esto, pero para un solo resultado no es crítico
  };

  const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
  
  const request = {
    requests: [{
      inputConfig: inputConfig,
      features: features,
      outputConfig: outputConfig,
    }],
  };

  try {
    const [operation] = await visionClient.asyncBatchAnnotateFiles(request);
    console.log('Operación de OCR asíncrona iniciada. Esperando resultados...');

    await operation.promise();
    console.log('Operación de OCR completada en GCS.');

    // --- LÓGICA FINAL: Descubrir el archivo de resultado ---
    console.log(`Buscando archivos de resultado en el prefijo: ${gcsOutputPrefix}`);
    const [files] = await bucket.getFiles({ prefix: gcsOutputPrefix });
    
    if (files.length === 0) {
      throw new Error(`No se encontraron archivos de resultado en gs://${GCS_BUCKET_NAME}/${gcsOutputPrefix}`);
    }

    // Tomamos el primer archivo encontrado
    const resultFile = files[0];
    console.log(`Archivo de resultado encontrado: ${resultFile.name}`);
    
    console.log(`Descargando resultado de gs://${GCS_BUCKET_NAME}/${resultFile.name} a ${outputJsonLocalPath}...`);
    await resultFile.download({ destination: outputJsonLocalPath });
    console.log(`Verificando el contenido de ${outputJsonLocalPath}...`);
    const downloadedOcrContent = fs.readFileSync(outputJsonLocalPath, 'utf-8');
    const downloadedOcrResult = JSON.parse(downloadedOcrContent);
    console.log('DEBUG OCR Structure:');
    console.log(`  responses length: ${downloadedOcrResult.responses?.length}`);
    console.log(`  fullTextAnnotation exists: ${!!downloadedOcrResult.responses[0]?.fullTextAnnotation}`);
    console.log(`  pages array length: ${downloadedOcrResult.responses[0]?.fullTextAnnotation?.pages?.length}`);
    console.log(`  pages[0] width: ${downloadedOcrResult.responses[0]?.fullTextAnnotation?.pages[0]?.width}`);
    if (downloadedOcrResult.responses[0]?.fullTextAnnotation?.pages.length > 1) {
        console.log(`  pages[1] width: ${downloadedOcrResult.responses[0]?.fullTextAnnotation?.pages[1]?.width}`);
    }
    const pageCount = downloadedOcrResult.responses[0]?.fullTextAnnotation?.pages?.length || 0;
    console.log(`DEBUG: El archivo OCR descargado contiene ${pageCount} páginas.`);
    // --------------------------------------------------------

    console.log(`
🎉 ¡AHORA SÍ! ¡ÉXITO TOTAL! 🎉`);
    console.log(`Resultado de OCR guardado en: ${outputJsonLocalPath}`);

    // Limpieza de todos los archivos en el prefijo de salida
    await Promise.all(files.map(file => file.delete()));
    await bucket.file(fileName).delete();
    console.log('Archivos temporales de GCS eliminados.');


  } catch (error) {
    console.error('Error durante la detección de texto en PDF:', error);
    throw error;
  }
}

const TEST_PDF_PATH = process.argv[2];
const OUTPUT_JSON_PATH = process.argv[3] || './ocr_output.json';

if (!TEST_PDF_PATH) {
  console.error('ERROR: Debes proporcionar la ruta a un archivo PDF.');
  process.exit(1);
}

detectTextInPdfFromGCS(TEST_PDF_PATH, OUTPUT_JSON_PATH)
  .then(() => console.log('Proceso OCR con GCS finalizado.'))
  .catch((err) => console.error('Error en el proceso OCR con GCS:', err));