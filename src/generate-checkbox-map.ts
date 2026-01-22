import * as fs from 'fs';
import * as path from 'path';

interface BoundingBoxFormStructure {
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    type?: string;
}

interface TextBlockFormStructure extends BoundingBoxFormStructure {
    text: string;
    confidence: number;
}

interface CheckboxFormStructure extends BoundingBoxFormStructure {}

interface FormStructure {
    summary: {
        total_rectangles: number;
        total_checkboxes: number;
        total_text_blocks: number;
    };
    rectangles_by_size: {
        [key: string]: BoundingBoxFormStructure[];
    };
    checkboxes: CheckboxFormStructure[];
    text_blocks: TextBlockFormStructure[];
}

interface OcrPage {
    width: number;
    height: number;
}

interface OcrResult {
    responses: { fullTextAnnotation: { pages: OcrPage[] } }[];
}

interface FieldCoordinatesBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

interface CheckboxOptionMap {
    value: string; // User-facing value
    code: string;  // Internal code for the option
    text_label: string; // The exact text to find in form_structure.json
}

function calculateDistance(textBlock: TextBlockFormStructure, checkbox: CheckboxFormStructure): number {
    const textCenterX = textBlock.x + textBlock.width / 2;
    const textCenterY = textBlock.y + textBlock.height / 2;
    const checkboxCenterX = checkbox.x + checkbox.width / 2;
    const checkboxCenterY = checkbox.y + checkbox.height / 2;

    const dx = checkboxCenterX - textCenterX;
    const dy = checkboxCenterY - textCenterY;

    // Prioritize checkboxes to the right and vertically aligned
    if (dx < 0 || Math.abs(dy) > textBlock.height / 2 + checkbox.height / 2) { // Checkbox must be to the right and somewhat vertically aligned
        return Infinity;
    }

    return Math.sqrt(dx * dx + dy * dy);
}

function normalizeCoordinates(coords: BoundingBoxFormStructure, pageWidth: number, pageHeight: number): FieldCoordinatesBox {
    return {
        minX: parseFloat((coords.x / pageWidth).toFixed(4)),
        maxX: parseFloat(((coords.x + coords.width) / pageWidth).toFixed(4)),
        minY: parseFloat((coords.y / pageHeight).toFixed(4)),
        maxY: parseFloat(((coords.y + coords.height) / pageHeight).toFixed(4)),
    };
}

async function generateCheckboxMap() {
    // [IN_PROGRESS] Leer form_structure.json y ocr_output.json (para dimensiones de página).
    const formStructurePath = path.join(__dirname, '..', 'form_structure.json');
    const ocrOutputPath = path.join(__dirname, '..', 'ocr_output.json');

    if (!fs.existsSync(formStructurePath)) {
        console.error(`ERROR: No se encuentra el archivo ${formStructurePath}.`);
        return;
    }
    if (!fs.existsSync(ocrOutputPath)) {
        console.error(`ERROR: No se encuentra el archivo ${ocrOutputPath}.`);
        return;
    }

    const formStructure: FormStructure = JSON.parse(fs.readFileSync(formStructurePath, 'utf-8'));
    const ocrResult: OcrResult = JSON.parse(fs.readFileSync(ocrOutputPath, 'utf-8'));

    const page = ocrResult.responses[0]?.fullTextAnnotation?.pages[0];
    if (!page) {
        console.error('ERROR: No se encontraron datos de página en ocr_output.json.');
        return;
    }
    const pageWidth = page.width;
    const pageHeight = page.height;

    // [IN_PROGRESS] Definir las opciones de "Titulación actual" y sus nombres de campo deseados.
    // Usaremos esta lista para buscar los text_blocks y luego sus checkboxes
    const titulacionOptions: CheckboxOptionMap[] = [
        { value: 'Sin titulación', code: '1', text_label: '1. Sin titulación' },
        { value: 'Certificado de Profesionalidad Nivel 1', code: '11', text_label: '11. Certificado de Profesionalidad Nivel 1' },
        { value: 'Formación Profesional Básica/Cualificación Profesional', code: '12', text_label: '12. Formación Profesional Básica/Cualificación Profesional' },
        { value: 'Título de graduado E.S.O./Graduado escolar', code: '2', text_label: '2. Título de graduado E.S.O./Graduado escolar' },
        // { value: 'Certificado de Profesionalidad Nivel 2', code: '21', text_label: 'Certificado de Profesionalidad Nivel 2' }, // This one is tricky, needs to be handled as nested or separate field if it belongs to a different group
        { value: 'Título de Bachiller', code: '3', text_label: '3. Título de Bachiller' },
        { value: 'Título de Técnico/ FP grado medio', code: '4', text_label: '4. Título de Técnico/ FP grado medio' },
        { value: 'Título Profesional enseñanzas música-danza;artes', code: '41', text_label: '41. Título Profesional enseñanzas música-danza;artes' },
        { value: 'Certificado de Profesionalidad Nivel 3', code: '42', text_label: '42. Certificado de Profesionalidad Nivel 3' },
        { value: 'Título de Técnico Superior/ FP grado superior', code: '5', text_label: '5. Título de Técnico Superior/ FP grado superior' },
        { value: 'E. universitarios 1º ciclo (Diplomatura-Grado)', code: '6', text_label: '6. E. universitarios 1º ciclo (Diplomatura-Grado)' },
        // The sub-options for 6. E. universitarios 1º ciclo (Diplomatura-Grado) like Grados universitarios de hasta 240 créditos
        // and Másteres oficiales universitarios and Especialidades CC. salud (residentes) are part of 7. E. universitarios 2º ciclo (Licenciatura-Máster)
        // Let's hold off on these for now and focus on the main ones.
        { value: 'E. universitarios 2º ciclo (Licenciatura-Máster)', code: '7', text_label: '7. E. universitarios 2º ciclo (Licenciatura-Máster)' },
        { value: 'E. universitarios 3º ciclo (Doctor)', code: '8', text_label: '8. E. universitarios 3º ciclo (Doctor)' },
        { value: 'Título de Doctor', code: '9', text_label: '9. Título de Doctor' },
        { value: 'Otra titulación', code: '10', text_label: '10. Otra titulación' },
        // The sub-options for 10. Otra titulación
        // { value: 'Carnet profesional', code: '10.1', text_label: '1. Carnet profesional' }, // This code numbering is inconsistent
        // { value: 'Enseñanzas de escuelas oficiales de idiomas', code: '10.2', text_label: '2. Enseñanzas de escuelas oficiales de idiomas' },
        // { value: 'Otra titulación no formal (especificar)', code: '10.3', text_label: '3. Otra titulación no formal (especificar)' },
    ];

    const generatedMap: { [key: string]: { value: string; code: string; box: FieldCoordinatesBox } } = {};

    for (const option of titulacionOptions) {
        // [IN_PROGRESS] Implementar la lógica para encontrar el `text_block` para cada opción.
        const matchingTextBlocks = formStructure.text_blocks.filter(block =>
            block.text.includes(option.text_label) || option.text_label.includes(block.text)
        );

        if (matchingTextBlocks.length === 0) {
            console.warn(`ADVERTENCIA: No se encontró el bloque de texto para "${option.text_label}"`);
            continue;
        }

        // Combine all parts of the text label if it's broken into multiple blocks by OCR
        // Find the bounding box that encompasses all matching text parts for accurate alignment
        let combinedTextBlock: TextBlockFormStructure | null = null;
        if (matchingTextBlocks.length > 1) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let combinedText = '';

            // Sort by X then Y to reassemble text correctly
            matchingTextBlocks.sort((a, b) => a.x - b.x === 0 ? a.y - b.y : a.x - b.x);

            for (const block of matchingTextBlocks) {
                minX = Math.min(minX, block.x);
                minY = Math.min(minY, block.y);
                maxX = Math.max(maxX, block.x + block.width);
                maxY = Math.max(maxY, block.y + block.height);
                combinedText += (combinedText.length > 0 && combinedText[combinedText.length-1] !== ' ' && block.text[0] !== ' ' ? ' ' : '') + block.text;
            }

            combinedTextBlock = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                page: matchingTextBlocks[0].page, // Assuming all on same page
                text: combinedText,
                confidence: matchingTextBlocks.reduce((sum, b) => sum + b.confidence, 0) / matchingTextBlocks.length
            };
            
            // Further filter if combined text is too different from expected label
            if (!combinedTextBlock.text.includes(option.text_label) && !option.text_label.includes(combinedTextBlock.text)) {
                // If combination didn't help or made it worse, fall back to simpler matching
                const bestSingleMatch = matchingTextBlocks.reduce((best, current) => 
                    Math.abs(current.text.length - option.text_label.length) < Math.abs(best.text.length - option.text_label.length) ? current : best
                );
                console.warn(`ADVERTENCIA: Coincidencia de texto combinada imperfecta para "${option.text_label}". Usando la mejor coincidencia simple: "${bestSingleMatch.text}"`);
                combinedTextBlock = bestSingleMatch;
            } else {
                 console.log(`INFO: Texto combinado para "${option.text_label}": "${combinedTextBlock.text}"`);
            }
        } else {
            combinedTextBlock = matchingTextBlocks[0];
            console.log(`INFO: Texto encontrado para "${option.text_label}": "${combinedTextBlock.text}"`);
        }

        if (!combinedTextBlock) {
             console.warn(`ADVERTENCIA: No se pudo obtener un bloque de texto final para "${option.text_label}"`);
             continue;
        }

        // [IN_PROGRESS] Implementar la lógica para encontrar el `checkbox` más cercano a cada `text_block` de opción.
        let closestCheckbox: CheckboxFormStructure | null = null;
        let minDistance = Infinity;

        for (const checkbox of formStructure.checkboxes) {
            if (checkbox.page !== combinedTextBlock.page) continue; // Must be on the same page

            const distance = calculateDistance(combinedTextBlock, checkbox);
            if (distance < minDistance) {
                minDistance = distance;
                closestCheckbox = checkbox;
            }
        }

        if (!closestCheckbox) {
            console.warn(`ADVERTENCIA: No se encontró un checkbox cercano para "${option.text_label}"`);
            continue;
        }

        // [IN_PROGRESS] Normalizar las coordenadas del `checkbox` encontrado.
        const normalizedBox = normalizeCoordinates(closestCheckbox, pageWidth, pageHeight);

        generatedMap[option.code] = {
            value: option.value,
            code: option.code,
            box: normalizedBox,
        };
    }

    // [IN_PROGRESS] Generar el código TypeScript para el FIELD_COORDINATES.mainLayout.checkbox_fields.titulacion.
    let outputCode = `      titulacion: [\n`;
    for (const code in generatedMap) {
        const item = generatedMap[code];
        outputCode += `        { value: '${item.value}', code: '${item.code}', box: { minX: ${item.box.minX}, maxX: ${item.box.maxX}, minY: ${item.box.minY}, maxY: ${item.box.maxY} } },\n`;
    }
    outputCode += `      ],\n`;

    console.log('\n--- CÓDIGO GENERADO PARA TITULACIÓN ---');
    console.log(outputCode);
    console.log('--- FIN CÓDIGO GENERADO ---');

    // [TODO] Actualizar final-parser.ts con el código generado.
    // This will be a manual step for me, so I'll output the code and mark the todo for myself.
}

generateCheckboxMap();
