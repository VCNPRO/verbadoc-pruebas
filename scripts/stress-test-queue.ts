// Script para cargar 100 documentos a la cola de procesamiento
// Uso: npx tsx scripts/stress-test-queue.ts <AUTH_TOKEN>

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const BASE_URL = 'https://www.verbadocpro.eu'; // URL de producción
const TEST_DIR = path.join(process.cwd(), 'test-docs_load_100');
const AUTH_TOKEN = process.argv[2];

if (!AUTH_TOKEN) {
  console.error('❌ Error: Debes proporcionar un token de autenticación (auth-token cookie)');
  console.error('Uso: npx tsx scripts/stress-test-queue.ts <AUTH_TOKEN>');
  process.exit(1);
}

// Schema básico para FUNDAE
const SCHEMA = [
  { "id": "f1", "name": "cif_empresa", "type": "STRING" },
  { "id": "f2", "name": "nombre_empresa", "type": "STRING" },
  { "id": "f3", "name": "dni_alumno", "type": "STRING" },
  { "id": "f4", "name": "nombre_alumno", "type": "STRING" },
  { "id": "f5", "name": "apellidos_alumno", "type": "STRING" },
  { "id": "f6", "name": "fecha_inicio", "type": "STRING" },
  { "id": "f7", "name": "fecha_fin", "type": "STRING" }
];

async function queueDocument(filePath: string, index: number) {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');
  const fileSize = fileBuffer.length;
  
  const documentId = `stress-test-${Date.now()}-${index}`;

  console.log(`📤 [${index+1}/100] Encolando: ${fileName}...`);

  try {
    const response = await fetch(`${BASE_URL}/api/queue-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth-token=${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        documentId,
        fileData: base64Data,
        fileName,
        fileSize,
        schema: SCHEMA,
        model: 'gemini-2.5-flash', // Usar modelo estándar para test
        userId: 'stress-tester'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log(`✅ [${index+1}] Encolado OK. Posición: ${result.queuePosition}`);
    return true;
  } catch (error: any) {
    console.error(`❌ [${index+1}] Error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando prueba de estrés de cola...');
  console.log(`📂 Directorio: ${TEST_DIR}`);
  console.log(`🌐 URL: ${BASE_URL}`);

  if (!fs.existsSync(TEST_DIR)) {
    console.error('❌ Directorio de prueba no encontrado');
    process.exit(1);
  }

  const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`📄 Archivos encontrados: ${files.length}`);

  // Limitar a 100 archivos
  const testFiles = files.slice(0, 100);

  let successCount = 0;
  
  // Encolar con concurrencia controlada (5 a la vez)
  for (let i = 0; i < testFiles.length; i += 5) {
    const chunk = testFiles.slice(i, i + 5);
    const promises = chunk.map((file, chunkIndex) => 
      queueDocument(path.join(TEST_DIR, file), i + chunkIndex)
    );
    
    const results = await Promise.all(promises);
    successCount += results.filter(Boolean).length;
    
    // Pequeña pausa para no saturar la red local
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏁 Encolado completado.`);
  console.log(`✅ Exitosos: ${successCount}`);
  console.log(`❌ Fallidos: ${testFiles.length - successCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⏳ Ahora, espera a que el Cron Job procese la cola.');
  console.log('💡 Puedes forzar el procesamiento llamando a: /api/process-queue');
}

main();
