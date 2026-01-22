import * as fs from 'fs';
import * as path from 'path';

interface BoundingBox {
  vertices: { x: number; y: number }[];
  normalizedVertices?: { x: number; y: number }[];
}
interface Word {
  boundingBox: BoundingBox;
  symbols: { text: string }[];
}
interface Page {
  width: number;
  height: number;
  blocks: { paragraphs: { words: Word[] }[] }[];
}
interface OcrResult {
  responses: { fullTextAnnotation: { pages: Page[] } }[];
}

function isWordInBox(word: Word, box: { minX: number; maxX: number; minY: number; maxY: number }, pageDimensions: { width: number; height: number }): boolean {
    const getVertices = (b: BoundingBox) => b.normalizedVertices || b.vertices;
    const wordVertices = getVertices(word.boundingBox);

    // Convert word's normalized bounding box to absolute
    const wordMinX = wordVertices[0].x * pageDimensions.width;
    const wordMaxX = wordVertices[1].x * pageDimensions.width;
    const wordMinY = wordVertices[0].y * pageDimensions.height;
    const wordMaxY = wordVertices[3].y * pageDimensions.height;

    // Convert target box (normalized) to absolute
    const boxMinX_abs = box.minX * pageDimensions.width;
    const boxMaxX_abs = box.maxX * pageDimensions.width;
    const boxMinY_abs = box.minY * pageDimensions.height;
    const boxMaxY_abs = box.maxY * pageDimensions.height;

    // Check for overlap
    const overlapX = Math.max(0, Math.min(wordMaxX, boxMaxX_abs) - Math.max(wordMinX, boxMinX_abs));
    const overlapY = Math.max(0, Math.min(wordMaxY, boxMaxY_abs) - Math.max(wordMinY, boxMinY_abs));

    // A word is considered "in" the box if there is significant overlap
    // For a small checkbox, even a small overlap is significant.
    const overlapArea = overlapX * overlapY;
    const wordArea = (wordMaxX - wordMinX) * (wordMaxY - wordMinY);
    const boxArea = (boxMaxX_abs - boxMinX_abs) * (boxMaxY_abs - boxMinY_abs);

    // If the word's text content is just 'X', 'x', '✓', 'v', we only need a small overlap
    const wordText = word.symbols.map(s => s.text).join('');
    const isMark = wordText.toLowerCase().match(/[x✓v]/);

    if (isMark) {
        return overlapArea > 0; // If it's a mark, any overlap is enough
    }

    // For other text, require a larger overlap percentage
    return overlapArea > 0.5 * wordArea || overlapArea > 0.5 * boxArea;
}

async function debugOcrBox() {
    const ocrOutputPath = "C:\\Users\\La Bestia\\verbadocpro\\ocr_output.json"; // Absolute path for reliability

    if (!fs.existsSync(ocrOutputPath)) {
        console.error(`ERROR: No se encuentra el archivo OCR en la ruta especificada: ${ocrOutputPath}. Por favor, asegúrate de que exista.`);
        return;
    }

    let ocrContent: string;
    try {
        ocrContent = fs.readFileSync(ocrOutputPath, 'utf-8');
    } catch (error: any) {
        console.error(`ERROR al leer el archivo OCR: ${error.message}`);
        return;
    }

    let ocrResult: OcrResult;
    try {
        ocrResult = JSON.parse(ocrContent);
    } catch (error: any) {
        console.error(`ERROR al parsear el JSON del OCR: ${error.message}`);
        console.error('Contenido del OCR (primeras 500 chars):', ocrContent.substring(0, 500));
        return;
    }

    const targetPage = 1; // Investigamos la página 1
    // Coordenadas para 'E. universitarios 2º ciclo (Licenciatura-Máster)' (código '7') dentro de 'titulacion'
    // Coordenadas actualizadas con las de la 'X' detectada en el OCR
    const boxToCheck = { minX: 0.4671, maxX: 0.4808, minY: 0.6073, maxY: 0.6187 };

    const allPagesData = ocrResult.responses.flatMap(r => r.fullTextAnnotation?.pages || []);

    const pageData = allPagesData[targetPage - 1];

    if (!pageData) {
        console.error(`ERROR: No se encontraron datos para la Página ${targetPage} en el OCR. Total de páginas encontradas en el OCR: ${allPagesData.length}`);
        return;
    }

    const pageDimensions = { width: pageData.width, height: pageData.height };

    console.log(`\n--- DEBUG: Contenido del OCR dentro de la casilla ${targetPage}-${JSON.stringify(boxToCheck)} ---`);
    console.log(`Buscando en Página ${targetPage} con dimensiones: ${pageDimensions.width}x${pageDimensions.height}`);
    console.log(`Casilla (Absoluta): x:${(boxToCheck.minX * pageDimensions.width).toFixed(2)}-${(boxToCheck.maxX * pageDimensions.width).toFixed(2)}, y:${(boxToCheck.minY * pageDimensions.height).toFixed(2)}-${(boxToCheck.maxY * pageDimensions.height).toFixed(2)}`);

    const allWordsOnPage = pageData.blocks.flatMap(b => b.paragraphs.flatMap(p => p.words));
    let foundWordsInBox = 0;

    for (const word of allWordsOnPage) {
        if (isWordInBox(word, boxToCheck, pageDimensions)) {
            const wordText = word.symbols.map(s => s.text).join('');
            const wv = word.boundingBox.normalizedVertices || word.boundingBox.vertices;
            const wminX = wv[0].x * pageDimensions.width;
            const wminY = wv[0].y * pageDimensions.height;
            const wmaxX = wv[1].x * pageDimensions.width;
            const wmaxY = wv[3].y * pageDimensions.height;

            console.log(`  - Word: "${wordText}"`);
            console.log(`    Coords (Normalized): minX:${wv[0].x.toFixed(4)}, minY:${wv[0].y.toFixed(4)}, maxX:${wv[1].x.toFixed(4)}, maxY:${wv[3].y.toFixed(4)}`);
            console.log(`    Coords (Absolute): x:${wminX.toFixed(2)}-${wmaxX.toFixed(2)}, y:${wminY.toFixed(2)}-${wmaxY.toFixed(2)}`);
            foundWordsInBox++;
        }
    }

    if (foundWordsInBox === 0) {
        console.log('  -> No se detectaron palabras dentro de la casilla especificada.');
        console.log('  -> Posibles causas: Las coordenadas son incorrectas, o el OCR no detectó nada en esa área.');
    } else {
        console.log(`  -> Se encontraron ${foundWordsInBox} palabras/caracteres dentro de la casilla.`);
    }
    console.log('--- FIN DEBUG ---');
}

debugOcrBox();
