import fs from 'fs';
import path from 'path';

// CONFIGURACIÓN
// const API_URL = 'http://localhost:5173/api/extract'; // URL de tu API local
const API_URL = 'https://www.verbadocpro.eu/api/extract'; // Descomenta para probar en producción
const SOURCE_DIR = path.join(process.cwd(), 'test-docs_load_100');
const CONCURRENCY = 50; // Número de peticiones simultáneas (igual que tu BATCH_SIZE)
const MODEL = 'gemini-2.5-flash'; // Modelo a usar

// Función para esperar (sleep)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para leer archivo y convertir a base64
function getFileContent(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

// Función para procesar un documento
async function processDocument(filePath, index, total) {
  const fileName = path.basename(filePath);
  const base64Data = getFileContent(filePath);
  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: 'application/pdf'
              }
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          // Schema simplificado para la prueba
          responseSchema: {
            type: "OBJECT",
            properties: {
              expediente: { type: "STRING" },
              cif: { type: "STRING" }
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;
    return { success: true, fileName, duration, data };

  } catch (error) {
    const duration = Date.now() - startTime;
    return { success: false, fileName, duration, error: error.message };
  }
}

async function runLoadTest() {
  console.log(`🚀 INICIANDO PRUEBA DE CARGA`);
  console.log(`📂 Directorio: ${SOURCE_DIR}`);
  console.log(`⚡ Concurrencia: ${CONCURRENCY}`);
  console.log(`🌐 API: ${API_URL}`);
  console.log('---------------------------------------------------');

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Directorio no encontrado: ${SOURCE_DIR}`);
    return;
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  const totalFiles = files.length;

  if (totalFiles === 0) {
    console.error(`❌ No hay PDFs en el directorio.`);
    return;
  }

  console.log(`📄 Archivos encontrados: ${totalFiles}`);
  console.log(`⏳ Estimación (a 10s/doc con concurrencia ${CONCURRENCY}): ~${Math.ceil(totalFiles / CONCURRENCY * 10)} segundos`);
  console.log('---------------------------------------------------\n');

  const results = [];
  const queue = [...files];
  let activeWorkers = 0;
  let completed = 0;
  const globalStartTime = Date.now();

  // Función worker que procesa de la cola
  const worker = async (id) => {
    while (queue.length > 0) {
      const fileName = queue.shift();
      const filePath = path.join(SOURCE_DIR, fileName);
      
      console.log(`[Worker ${id}] Procesando ${fileName}...`); // Cambiado a console.log
      
      const result = await processDocument(filePath, completed + 1, totalFiles);
      results.push(result);
      completed++;

      const symbol = result.success ? '✅' : '❌';
      console.log(`${symbol} [${completed}/${totalFiles}] ${fileName} - ${result.duration}ms ${result.success ? '' : `(${result.error})`}`);
    }
  };

  // Iniciar workers
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, totalFiles); i++) {
    workers.push(worker(i + 1));
  }

  await Promise.all(workers);

  const totalTime = Date.now() - globalStartTime;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgTime = results.reduce((acc, r) => acc + r.duration, 0) / results.length;

  console.log('\n===================================================\n');
  console.log('📊 RESULTADOS DE LA PRUEBA');
  console.log('===================================================');
  console.log(`Total Archivos: ${totalFiles}`);
  console.log(`Tiempo Total:   ${(totalTime / 1000).toFixed(2)} segundos`);
  console.log(`✅ Éxitos:      ${successful}`);
  console.log(`❌ Fallos:      ${failed}`);
  console.log(`⏱️  Promedio/doc: ${avgTime.toFixed(0)} ms`);
  console.log(`🚀 Velocidad:    ${(totalFiles / (totalTime / 60000)).toFixed(1)} docs/minuto`);
  console.log(`📦 Capacidad/hora: ${(totalFiles / (totalTime / 3600000)).toFixed(0)} docs/hora`);
  console.log('===================================================');
}

runLoadTest();