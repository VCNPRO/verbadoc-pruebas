import * as fs from 'fs';
import * as path from 'path';

// --- Definiciones de Tipos de Datos ---
interface BoundingBox {
  vertices: { x: number; y: number }[];
  normalizedVertices?: { x: number; y: number }[];
}
interface Word {
  boundingBox: BoundingBox;
  symbols: { text: string }[];
}
interface OcrResult {
  responses: {
    fullTextAnnotation: {
      pages: {
        blocks: {
          paragraphs: {
            words: Word[];
          }[];
        }[];
      }[];
    };
  }[];
}

/**
 * --- SCRIPT EXPLORADOR DE ÁREA ---
 * Recibe coordenadas X, Y y un radio, y muestra todas las palabras encontradas en esa área.
 */
function exploreArea(centerX: number, centerY: number, radius: number, ocrResult: OcrResult) {
  console.log(`Explorando área alrededor de (x: ${centerX}, y: ${centerY}) con un radio de ${radius}`);
  
  const allWords = ocrResult.responses[0]?.fullTextAnnotation?.pages[0]?.blocks.flatMap(b => b.paragraphs.flatMap(p => p.words)) || [];
  const getVertices = (b: BoundingBox) => b.normalizedVertices || b.vertices;

  const wordsInArea = allWords.filter(word => {
    const wordVertices = getVertices(word.boundingBox);
    const wordCenterX = (wordVertices[0].x + wordVertices[1].x) / 2;
    const wordCenterY = (wordVertices[0].y + wordVertices[3].y) / 2;

    // Calculamos la distancia del centro de la palabra a nuestro punto de exploración
    const distance = Math.sqrt(Math.pow(wordCenterX - centerX, 2) + Math.pow(wordCenterY - centerY, 2));
    
    return distance <= radius;
  });

  if (wordsInArea.length > 0) {
    console.log(`
--- Palabras encontradas en el área ---`);
    wordsInArea.forEach(word => {
      const wordText = word.symbols.map(s => s.text).join('');
      const wordVertices = getVertices(word.boundingBox);
      console.log(`- Texto: "${wordText}"`);
      console.log(`  Coordenadas: ${JSON.stringify(wordVertices)}`);
    });
  } else {
    console.log(`No se encontraron palabras en el área especificada.`);
  }
}

function main() {
  const ocrJsonPath = './ocr_output.json';
  // Los argumentos ahora son: X Y RADIO
  const centerX = parseFloat(process.argv[2]);
  const centerY = parseFloat(process.argv[3]);
  const radius = parseFloat(process.argv[4]) || 0.1;

  if (isNaN(centerX) || isNaN(centerY)) {
    console.error("Uso: ts-node src/parse-ocr-result.ts <coordenada_x> <coordenada_y> [radio]");
    console.error("Ejemplo: ts-node src/parse-ocr-result.ts 0.128 0.417");
    return;
  }
  
  if (!fs.existsSync(ocrJsonPath)) {
    console.error(`ERROR: No se encuentra el archivo ${ocrJsonPath}.`);
    return;
  }

  const ocrResult: OcrResult = JSON.parse(fs.readFileSync(ocrJsonPath, 'utf-8'));
  exploreArea(centerX, centerY, radius, ocrResult);
}

main();
