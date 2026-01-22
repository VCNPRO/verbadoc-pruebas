import fs from 'fs';
import path from 'path';

const SOURCE_DIR = path.join(process.cwd(), 'test-docs_reales');
const TARGET_DIR = path.join(process.cwd(), 'test-docs_load_100');
const TARGET_COUNT = 100;

async function prepareLoadTest() {
  console.log('🚀 Preparando prueba de carga (100 documentos)...');

  // 1. Verificar origen
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Directorio de origen no encontrado: ${SOURCE_DIR}`);
    return;
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    console.error('❌ No hay archivos PDF en el directorio de origen.');
    return;
  }

  console.log(`📋 Encontrados ${files.length} archivos base.`);

  // 2. Preparar destino
  if (fs.existsSync(TARGET_DIR)) {
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  // 3. Generar copias
  let count = 0;
  let multiplier = Math.ceil(TARGET_COUNT / files.length);

  console.log(`🔄 Multiplicando cada archivo por ~${multiplier} veces...`);

  for (let i = 0; i < multiplier; i++) {
    for (const file of files) {
      if (count >= TARGET_COUNT) break;

      const sourcePath = path.join(SOURCE_DIR, file);
      const ext = path.extname(file);
      const name = path.basename(file, ext);
      const targetName = `${name}_load_test_${i + 1}${ext}`;
      const targetPath = path.join(TARGET_DIR, targetName);

      fs.copyFileSync(sourcePath, targetPath);
      count++;
    }
  }

  console.log(`
✅ Generados ${count} archivos en: ${TARGET_DIR}`);
  console.log('👉 Ahora puedes subir estos archivos a la aplicación para la prueba de carga.');
}

prepareLoadTest();
