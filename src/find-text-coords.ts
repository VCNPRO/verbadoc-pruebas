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
 * --- SCRIPT DETECTIVE DE COORDENADAS ---
 * Busca una palabra o frase específica en el ocr_output.json y devuelve sus coordenadas.
 */
function findCoordinatesForText(searchText: string, ocrResult: OcrResult) {
  if (!searchText) {
    console.error("Por favor, proporciona un texto para buscar. Ejemplo: ts-node src/find-text-coords.ts B94123908");
    return;
  }

  const searchWords = searchText.toLowerCase().split(' ');
  const allWords = ocrResult.responses[0]?.fullTextAnnotation?.pages[0]?.blocks.flatMap(b => b.paragraphs.flatMap(p => p.words)) || [];

  let found = false;

  for (let i = 0; i <= allWords.length - searchWords.length; i++) {
    let isMatch = true;
    const sequenceOfWords: Word[] = [];

    for (let j = 0; j < searchWords.length; j++) {
      const ocrWord = allWords[i + j].symbols.map(s => s.text).join('').toLowerCase();
      // Usamos 'includes' para una búsqueda más flexible
      if (!ocrWord.includes(searchWords[j])) {
        isMatch = false;
        break;
      }
      sequenceOfWords.push(allWords[i + j]);
    }

    if (isMatch) {
      found = true;
      console.log(`Coordenadas encontradas para el texto que contiene "${searchText}":`);
      
      const getVertices = (box: BoundingBox) => box.normalizedVertices || box.vertices;

      const firstWordVertices = getVertices(sequenceOfWords[0].boundingBox);
      const lastWordVertices = getVertices(sequenceOfWords[sequenceOfWords.length - 1].boundingBox);

      const combinedBox = [
        { x: firstWordVertices[0].x, y: firstWordVertices[0].y },
        { x: lastWordVertices[1].x, y: lastWordVertices[1].y },
        { x: lastWordVertices[2].x, y: lastWordVertices[2].y },
        { x: firstWordVertices[3].x, y: firstWordVertices[3].y },
      ];
      
      console.log(JSON.stringify(combinedBox, null, 2));
      // Continuamos el bucle para encontrar todas las ocurrencias posibles
    }
  }

  if (!found) {
    console.log(`No se encontró un texto que contenga "${searchText}" en el documento.`);
  }
}

function main() {
  const ocrJsonPath = './ocr_output.json';
  const searchText = process.argv[2]; 

  if (!fs.existsSync(ocrJsonPath)) {
    console.error(`ERROR: No se encuentra el archivo ${ocrJsonPath}.`);
    return;
  }

  const ocrResult: OcrResult = JSON.parse(fs.readFileSync(ocrJsonPath, 'utf-8'));
  findCoordinatesForText(searchText, ocrResult);
}

main();
