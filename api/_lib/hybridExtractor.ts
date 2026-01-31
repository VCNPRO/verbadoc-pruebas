/**
 * FASE 3: Extractor Híbrido — Gemini lee TODO directamente
 * api/_lib/hybridExtractor.ts
 *
 * Procesamiento 100% server-side:
 * 1. Recibe PDF buffer
 * 2. Renderiza a PNG con pdfjs-dist + @napi-rs/canvas (server-side, 300 DPI)
 * 3. Gemini lee TODOS los campos (texto + checkboxes) en una sola llamada
 * 4. Validación de valores
 *
 * Feature flag: USE_HYBRID_EXTRACTION
 */

import { renderPdfToImages, type RenderedPage } from './pdfRenderer.js';
import { GoogleGenAI } from '@google/genai';

// --- Types ---

export interface HybridExtractionResult {
  extractedData: Record<string, any>;
  checkboxResults: Record<string, {
    value: any;
    state: 'GEMINI_READ';
    confidence: number;
    needsHumanReview: boolean;
  }>;
  textResults: Record<string, any>;
  overallConfidence: number;
  fieldsNeedingReview: string[];
  method: 'hybrid_cv_gemini';
  localizationMethod: 'gemini_direct';
  processingTimeMs: number;
}

// --- Prompt completo: Gemini lee TODO ---
const FULL_EXTRACTION_PROMPT = `Eres un lector experto de formularios FUNDAE de evaluación de cursos.
Analiza las imágenes de este formulario y extrae TODOS los campos.

PÁGINA 1 — Datos del participante:
- numero_expediente: Formato "FXXXXXX" o código alfanumérico. Parte superior. Si no es legible devuelve "NC".
- perfil: Una letra mayúscula (ej: "B"). Si no es legible devuelve "NC".
- cif_empresa: Formato letra + 8 dígitos (ej: "B12345678"). Si no es legible devuelve "NC".
- numero_accion: Número de 1-5 dígitos. Si no es legible devuelve "NC".
- numero_grupo: Número de 1-4 dígitos. Si no es legible devuelve "NC".
- denominacion_aaff: Nombre completo del curso/acción formativa. Si no es legible devuelve "NC".
- modalidad: "Presencial", "Teleformación" o "Mixta". Mira qué checkbox tiene una MARCA CLARA de bolígrafo dentro. Si ninguno tiene marca, devuelve "NC".
- sexo: "1" (Mujer), "2" (Hombre) o "9" (No contesta). IMPORTANTE: El checkbox de "Mujer" aparece primero (arriba o izquierda), luego "Hombre", luego "No contesta". Solo devuelve el código del que tenga una MARCA CLARA de bolígrafo. Si ninguno tiene marca, devuelve "NC".
- edad: Número entero entre 16 y 99. Si no es legible devuelve "NC".
- titulacion: Código de la titulación marcada. Posibles códigos: 1, 11, 111, 12, 2, 21, 3, 4, 41, 42, 5, 6, 6.1, 7, 7.1, 7.3, 7.4, 8, 9, 99. Devuelve SOLO el código del checkbox que tenga marca clara. Si ninguno tiene marca, devuelve "NC".
- otra_titulacion_especificar: Texto libre si existe, si no "NC".
- categoria_profesional: "1" a "6" o "9" (No contesta). Si ninguno tiene marca, devuelve "NC".
- horario_curso: "1" (Dentro jornada), "2" (Fuera), "3" (Ambas), "9" (NC). Si ninguno tiene marca, devuelve "NC".
- porcentaje_jornada: "1" (<25%), "2" (25-50%), "3" (>50%), "9" (NC). Si ninguno tiene marca, devuelve "NC".
- tamaño_empresa: "1" (1-9), "2" (10-49), "3" (50-99), "4" (100-250), "5" (>250), "9" (NC). Si ninguno tiene marca, devuelve "NC".
- lugar_trabajo: Nombre de provincia española. Si no es legible devuelve "NC".

PÁGINA 2 — Valoraciones (tabla con escala NC, 1, 2, 3, 4):

⚠️⚠️⚠️ ERROR COMÚN QUE DEBES EVITAR ⚠️⚠️⚠️
La PRIMERA casilla de cada fila es NC (No Contesta). NO LA IGNORES.
Si ignoras la casilla NC y empiezas a contar desde "1", todos tus valores estarán DESPLAZADOS +1 y serán INCORRECTOS.

La tabla tiene EXACTAMENTE 5 casillas por fila. De IZQUIERDA a DERECHA:
  □ □ □ □ □
  NC 1  2  3  4

  Casilla 1 (más a la IZQUIERDA) = NC
  Casilla 2 = 1
  Casilla 3 = 2
  Casilla 4 = 3
  Casilla 5 (más a la DERECHA) = 4

⚠️ MÉTODO DE LECTURA OBLIGATORIO para cada fila:
1. Mira la CABECERA de la sección (donde está impreso "NC  1  2  3  4")
2. La casilla que está DEBAJO de "NC" es NC, la que está DEBAJO de "1" es 1, etc.
3. Traza una línea vertical imaginaria desde la etiqueta de la cabecera hasta la casilla de la fila
4. El valor es la etiqueta de la cabecera que queda JUSTO ENCIMA de la casilla marcada

EJEMPLO: Si la marca está en la TERCERA casilla desde la izquierda → el valor es "2" (NO "3").
EJEMPLO: Si la marca está en la CUARTA casilla desde la izquierda → el valor es "3" (NO "4").

SOLO cuenta como marcado si hay un trazo CLARO de bolígrafo (X, ✓, relleno, trazo) DENTRO de la casilla.
Una casilla vacía (solo los bordes impresos del cuadrado) NO está marcada.
Si no hay NINGUNA casilla marcada en la fila, devuelve "NC".

- valoracion_1_1: Pregunta 1.1 (Organización del curso)
- valoracion_1_2: Pregunta 1.2
- valoracion_2_1: Pregunta 2.1 (Contenidos y metodología)
- valoracion_2_2: Pregunta 2.2
- valoracion_3_1: Pregunta 3.1 (Duración y horario)
- valoracion_3_2: Pregunta 3.2
- valoracion_4_1_formadores: Pregunta 4.1 fila FORMADORES (primera sub-fila de 4.1)
- valoracion_4_1_tutores: Pregunta 4.1 fila TUTORES (segunda sub-fila de 4.1)
- valoracion_4_2_formadores: Pregunta 4.2 fila FORMADORES (primera sub-fila de 4.2)
- valoracion_4_2_tutores: Pregunta 4.2 fila TUTORES (segunda sub-fila de 4.2)
- valoracion_5_1: Pregunta 5.1 (Medios didácticos)
- valoracion_5_2: Pregunta 5.2
- valoracion_6_1: Pregunta 6.1 (Instalaciones y medios técnicos)
- valoracion_6_2: Pregunta 6.2
- valoracion_7_1: Pregunta 7.1 (Solo teleformación/mixta). Si la modalidad es Presencial, devuelve "NA".
- valoracion_7_2: Pregunta 7.2 (Solo teleformación/mixta). Si la modalidad es Presencial, devuelve "NA".
- valoracion_8_1: Pregunta 8.1 — Tiene DOS checkboxes: "Sí" y "No". SOLO devuelve "Sí" o "No" si uno de ellos tiene marca CLARA de bolígrafo. Si AMBOS están vacíos (sin marca), devuelve "NC".
- valoracion_8_2: Pregunta 8.2 — Igual que 8.1. "Sí", "No" o "NC" si ninguno está marcado.
- valoracion_9_1: Pregunta 9.1 (Valoración general)
- valoracion_9_2: Pregunta 9.2
- valoracion_9_3: Pregunta 9.3
- valoracion_9_4: Pregunta 9.4
- valoracion_9_5: Pregunta 9.5
- valoracion_10: Pregunta 10 (Grado satisfacción general)
- recomendaria_curso: "Sí", "No" o "NC" si ninguno está marcado. Misma regla que 8.1/8.2.
- sugerencias: Texto libre del participante. Si no hay texto escrito, devuelve "NC".
- fecha_cumplimentacion: Formato DD/MM/YYYY. Si no es legible devuelve "NC".

REGLAS CRÍTICAS:
1. NUNCA devuelvas null. Si un campo no tiene datos, devuelve "NC".
2. Un checkbox está marcado SOLO si tiene un trazo de bolígrafo visible (X, ✓, relleno, tachadura) DENTRO del cuadrado. Los bordes impresos del cuadrado NO cuentan como marca.
3. En caso de DUDA sobre si hay marca o no, devuelve "NC". Es mejor decir "no contesta" que inventar.
4. Para campos binarios (8.1, 8.2, recomendaría): si no ves marca clara ni en "Sí" ni en "No", devuelve "NC".
5. Para la tabla de valoraciones: cada fila solo puede tener UNA columna marcada (NC, 1, 2, 3 o 4).
6. Sé muy cuidadoso con el sexo: verifica cuál de los checkboxes (Mujer=1, Hombre=2, NC=9) tiene realmente marca.

⚠️ PROTOCOLO ANTI-ALUCINACIÓN PARA VALORACIONES ⚠️

ATENCIÓN: Este es un proyecto gubernamental con 16.000 documentos. Un valor INVENTADO es INACEPTABLE.
Para CADA fila de valoración (1.1, 1.2, 2.1... hasta 10) y CADA checkbox (sexo, modalidad, categoría, etc.):

PASO 1 - EXAMINA las casillas de esa fila/campo una por una.
PASO 2 - DECIDE:
  - UNA SOLA casilla con marca CLARA e INEQUÍVOCA de bolígrafo → ese valor
  - NINGUNA casilla tiene marca de bolígrafo → "NC"
  - Marca DUDOSA (sombra, mancha, borde grueso, artefacto de escaneo) → "NC"
  - MÁS DE UNA casilla marcada → "NC"
  - CUALQUIER nivel de duda → "NC"

RECUERDA: Una casilla VACÍA tiene solo los bordes impresos. NO la confundas con una marca.
Los artefactos de escaneo, sombras de dobleces del papel, y bordes gruesos NO son marcas de bolígrafo.

ES MEJOR 100 NC DE MÁS QUE 1 VALOR INVENTADO.
Un NC erróneo se corrige fácilmente en revisión humana. Un valor inventado puede pasar desapercibido y causar errores graves.

Devuelve SOLO un JSON con todos los campos listados arriba. NUNCA uses null, usa "NC" para campos sin dato.`;

// --- Prompt de verificación anti-alucinación (CAPA 2) ---
function buildVerificationPrompt(fieldsToVerify: { field: string; value: string; questionLabel: string }[]): string {
  const fieldList = fieldsToVerify.map(f =>
    `- ${f.field}: La primera pasada dijo "${f.value}" para "${f.questionLabel}". ¿Hay una marca CLARA e INEQUÍVOCA de bolígrafo en la casilla ${f.value} de esa fila?`
  ).join('\n');

  return `VERIFICACIÓN ESTRICTA DE CHECKBOXES — ANTI-ALUCINACIÓN

Eres un verificador independiente. La primera IA ha extraído valores de un formulario FUNDAE.
Tu trabajo es VERIFICAR si el valor extraído es CORRECTO — es decir, si la marca de bolígrafo está realmente en la COLUMNA indicada.

ESTRUCTURA DE LA TABLA DE VALORACIONES:
Las columnas van de IZQUIERDA a DERECHA: NC, 1, 2, 3, 4
Usa la CABECERA impresa ("NC  1  2  3  4") como referencia para identificar cada columna.

CAMPOS A VERIFICAR:
${fieldList}

Para CADA campo:
1. Localiza la fila de esa pregunta en la tabla
2. Localiza la CABECERA de la sección ("NC  1  2  3  4")
3. Identifica EN QUÉ COLUMNA hay marca de bolígrafo, contando desde la izquierda (1ª=NC, 2ª=1, 3ª=2, 4ª=3, 5ª=4)
4. Compara con el valor que extrajo la primera IA

Responde:
- "CONFIRMADO" — la marca está efectivamente en la columna del valor indicado
- "NO_CONFIRMADO" — la marca está en OTRA columna, no hay marca, o tienes duda

REGLAS:
1. Solo confirma si la marca está en la columna EXACTA del valor indicado
2. Sombras de escaneo, bordes gruesos, dobleces del papel NO son marcas
3. Si no puedes ubicar la fila/pregunta con certeza → NO_CONFIRMADO
4. Ante CUALQUIER duda → NO_CONFIRMADO

Responde SOLO con JSON: { "campo": "CONFIRMADO" o "NO_CONFIRMADO" }
Ejemplo: { "valoracion_1_1": "CONFIRMADO", "valoracion_2_1": "NO_CONFIRMADO" }`;
}

// Mapeo de campos a etiquetas legibles para el prompt de verificación
const FIELD_LABELS: Record<string, string> = {
  valoracion_1_1: 'Pregunta 1.1 (Organización del curso)',
  valoracion_1_2: 'Pregunta 1.2',
  valoracion_2_1: 'Pregunta 2.1 (Contenidos y metodología)',
  valoracion_2_2: 'Pregunta 2.2',
  valoracion_3_1: 'Pregunta 3.1 (Duración y horario)',
  valoracion_3_2: 'Pregunta 3.2',
  valoracion_4_1_formadores: 'Pregunta 4.1 fila FORMADORES',
  valoracion_4_1_tutores: 'Pregunta 4.1 fila TUTORES',
  valoracion_4_2_formadores: 'Pregunta 4.2 fila FORMADORES',
  valoracion_4_2_tutores: 'Pregunta 4.2 fila TUTORES',
  valoracion_5_1: 'Pregunta 5.1 (Medios didácticos)',
  valoracion_5_2: 'Pregunta 5.2',
  valoracion_6_1: 'Pregunta 6.1 (Instalaciones)',
  valoracion_6_2: 'Pregunta 6.2',
  valoracion_7_1: 'Pregunta 7.1 (Teleformación)',
  valoracion_7_2: 'Pregunta 7.2 (Teleformación)',
  valoracion_9_1: 'Pregunta 9.1 (Valoración general)',
  valoracion_9_2: 'Pregunta 9.2',
  valoracion_9_3: 'Pregunta 9.3',
  valoracion_9_4: 'Pregunta 9.4',
  valoracion_9_5: 'Pregunta 9.5',
  valoracion_10: 'Pregunta 10 (Satisfacción general)',
  valoracion_8_1: 'Pregunta 8.1 (Sí/No)',
  valoracion_8_2: 'Pregunta 8.2 (Sí/No)',
  recomendaria_curso: 'Recomendaría el curso (Sí/No)',
};

/**
 * CAPA 2: Segunda pasada de verificación anti-alucinación.
 * Solo verifica campos donde Gemini devolvió un VALOR (no NC).
 * Si la verificación dice NO_CONFIRMADO → se cambia a NC.
 */
async function verifyValuations(
  extractedData: Record<string, any>,
  pages: { buffer: Buffer; pageNumber: number }[],
  apiKey: string,
  modelId: string
): Promise<{ changed: string[]; verified: string[]; skipped: boolean }> {
  const allValuationFields = [
    'valoracion_1_1', 'valoracion_1_2',
    'valoracion_2_1', 'valoracion_2_2',
    'valoracion_3_1', 'valoracion_3_2',
    'valoracion_4_1_formadores', 'valoracion_4_1_tutores',
    'valoracion_4_2_formadores', 'valoracion_4_2_tutores',
    'valoracion_5_1', 'valoracion_5_2',
    'valoracion_6_1', 'valoracion_6_2',
    'valoracion_7_1', 'valoracion_7_2',
    'valoracion_9_1', 'valoracion_9_2', 'valoracion_9_3', 'valoracion_9_4', 'valoracion_9_5',
    'valoracion_10',
    'valoracion_8_1', 'valoracion_8_2', 'recomendaria_curso',
  ];

  // Solo verificar campos con valor (no NC, no NA)
  const fieldsToVerify = allValuationFields
    .filter(f => {
      const v = String(extractedData[f] || 'NC');
      return v !== 'NC' && v !== 'NA';
    })
    .map(f => ({
      field: f,
      value: String(extractedData[f]),
      questionLabel: FIELD_LABELS[f] || f,
    }));

  if (fieldsToVerify.length === 0) {
    console.log('[anti-hallucination] Todos los campos son NC/NA, no hay nada que verificar');
    return { changed: [], verified: [], skipped: true };
  }

  console.log(`[anti-hallucination] CAPA 2: Verificando ${fieldsToVerify.length} campos con valor...`);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildVerificationPrompt(fieldsToVerify);

    // Enviar página 2 (donde están las valoraciones) + opcionalmente página 1
    const pagesToSend = pages.filter(p => p.pageNumber <= 2);
    const parts: any[] = [{ text: prompt }];
    for (const page of pagesToSend) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: page.buffer.toString('base64'),
        },
      });
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
        topK: 1,
        topP: 0.1,
      },
    });

    const responseText = response.text || '{}';
    let verification: Record<string, string>;
    try {
      verification = JSON.parse(responseText.replace(/```json|```/g, '').trim());
    } catch {
      console.error('[anti-hallucination] Error parseando respuesta de verificación, manteniendo valores originales');
      return { changed: [], verified: [], skipped: true };
    }

    const changed: string[] = [];
    const verified: string[] = [];

    for (const { field } of fieldsToVerify) {
      const result = verification[field];
      if (result === 'NO_CONFIRMADO') {
        console.log(`[anti-hallucination] ❌ ${field}: "${extractedData[field]}" → NC (no confirmado)`);
        extractedData[field] = 'NC';
        changed.push(field);
      } else if (result === 'CONFIRMADO') {
        console.log(`[anti-hallucination] ✅ ${field}: "${extractedData[field]}" confirmado`);
        verified.push(field);
      } else {
        // Respuesta inesperada → conservador: cambiar a NC
        console.log(`[anti-hallucination] ⚠️ ${field}: respuesta inesperada "${result}" → NC`);
        extractedData[field] = 'NC';
        changed.push(field);
      }
    }

    console.log(`[anti-hallucination] Resultado: ${verified.length} confirmados, ${changed.length} cambiados a NC`);
    return { changed, verified, skipped: false };
  } catch (error: any) {
    console.error(`[anti-hallucination] Error en verificación (no bloquea): ${error.message}`);
    return { changed: [], verified: [], skipped: true };
  }
}

/**
 * Extracción directa: Gemini lee todo el formulario.
 */
export async function extractHybrid(
  pdfBuffer: Buffer,
  options?: {
    geminiApiKey?: string;
    geminiModel?: string;
  }
): Promise<HybridExtractionResult> {
  const startTime = Date.now();
  const apiKey = options?.geminiApiKey || process.env.GOOGLE_API_KEY || '';
  const modelId = options?.geminiModel || 'gemini-3-pro-preview';

  if (!apiKey) {
    throw new Error('No hay GOOGLE_API_KEY configurada');
  }

  // ========================================
  // PASO 1: Renderizar PDF a PNG (server-side)
  // ========================================
  console.log('[hybridExtractor] Renderizando PDF a PNG server-side (300 DPI)...');
  let pages: RenderedPage[];
  try {
    pages = await renderPdfToImages(pdfBuffer, 300);
  } catch (error: any) {
    console.error('[hybridExtractor] Error renderizando PDF:', error.message);
    throw new Error(`No se pudo renderizar el PDF: ${error.message}`);
  }

  if (pages.length === 0) {
    throw new Error('El PDF no contiene páginas');
  }

  console.log(`[hybridExtractor] ${pages.length} página(s) renderizadas`);

  // Detectar formularios en horizontal (landscape)
  const landscapePages = pages.filter(p => p.width > p.height);
  const isLandscape = landscapePages.length > 0;
  if (isLandscape) {
    console.log(`[hybridExtractor] ⚠️ Formulario HORIZONTAL detectado: ${landscapePages.map(p => `pág ${p.pageNumber} (${p.width}x${p.height})`).join(', ')}`);
  }

  // ========================================
  // PASO 2: Gemini lee TODO directamente
  // ========================================
  console.log(`[hybridExtractor] Gemini (${modelId}) leyendo formulario completo...`);

  const ai = new GoogleGenAI({ apiKey });

  // Enviar solo páginas 1 y 2 (donde están los datos FUNDAE)
  const pagesToSend = pages.filter(p => p.pageNumber <= 2);
  const parts: any[] = [{ text: FULL_EXTRACTION_PROMPT }];

  for (const page of pagesToSend) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: page.buffer.toString('base64'),
      },
    });
  }

  const response = await ai.models.generateContent({
    model: modelId,
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      temperature: 0,
      topK: 1,
      topP: 0.1,
    },
  });

  const responseText = response.text || '{}';
  let extractedData: Record<string, any>;
  try {
    extractedData = JSON.parse(responseText.replace(/```json|```/g, '').trim());
  } catch (parseError: any) {
    console.error('[hybridExtractor] Error parseando respuesta Gemini:', parseError.message);
    console.error('[hybridExtractor] Respuesta raw:', responseText.substring(0, 500));
    throw new Error('Gemini devolvió JSON inválido');
  }

  console.log(`[hybridExtractor] Gemini extrajo ${Object.keys(extractedData).length} campos`);

  // ========================================
  // PASO 3: Validar y normalizar valores
  // ========================================
  const checkboxResults: HybridExtractionResult['checkboxResults'] = {};
  const fieldsNeedingReview: string[] = [];

  // Campos de valoración válidos
  const validValuationValues = ['NC', '1', '2', '3', '4', 'NA'];
  const validBinaryValues = ['Sí', 'Si', 'No', 'NC'];

  const valuationFields = [
    'valoracion_1_1', 'valoracion_1_2',
    'valoracion_2_1', 'valoracion_2_2',
    'valoracion_3_1', 'valoracion_3_2',
    'valoracion_4_1_formadores', 'valoracion_4_1_tutores',
    'valoracion_4_2_formadores', 'valoracion_4_2_tutores',
    'valoracion_5_1', 'valoracion_5_2',
    'valoracion_6_1', 'valoracion_6_2',
    'valoracion_7_1', 'valoracion_7_2',
    'valoracion_9_1', 'valoracion_9_2', 'valoracion_9_3', 'valoracion_9_4', 'valoracion_9_5',
    'valoracion_10',
  ];

  const binaryFields = ['valoracion_8_1', 'valoracion_8_2', 'recomendaria_curso'];

  // Validar valoraciones
  for (const field of valuationFields) {
    const raw = String(extractedData[field] || 'NC');
    const value = validValuationValues.includes(raw) ? raw : 'NC';
    extractedData[field] = value;
    checkboxResults[field] = {
      value,
      state: 'GEMINI_READ',
      confidence: value !== 'NC' ? 0.85 : 0.70,
      needsHumanReview: false,
    };
  }

  // Validar binarios
  for (const field of binaryFields) {
    let raw = String(extractedData[field] || 'NC');
    if (raw === 'Si') raw = 'Sí';
    const value = validBinaryValues.includes(raw) ? raw : 'NC';
    extractedData[field] = value;
    checkboxResults[field] = {
      value,
      state: 'GEMINI_READ',
      confidence: (value === 'Sí' || value === 'No') ? 0.85 : 0.70,
      needsHumanReview: false,
    };
  }

  // Validar campos de checkbox simples
  const simpleCheckboxFields = ['modalidad', 'sexo', 'titulacion', 'categoria_profesional', 'horario_curso', 'porcentaje_jornada', 'tamaño_empresa'];
  for (const field of simpleCheckboxFields) {
    const value = extractedData[field];
    if (value && value !== 'NC' && value !== null) {
      checkboxResults[field] = {
        value,
        state: 'GEMINI_READ',
        confidence: 0.85,
        needsHumanReview: false,
      };
    } else {
      checkboxResults[field] = {
        value: value || 'NC',
        state: 'GEMINI_READ',
        confidence: 0.70,
        needsHumanReview: false,
      };
    }
  }

  // ========================================
  // PASO 3b: CAPA 2 — Verificación anti-alucinación
  // Segunda pasada independiente para confirmar valoraciones
  // ========================================
  const verificationResult = await verifyValuations(
    extractedData,
    pagesToSend,
    apiKey,
    modelId
  );

  // Actualizar confianza de campos cambiados a NC por verificación
  for (const field of verificationResult.changed) {
    if (checkboxResults[field]) {
      checkboxResults[field].value = 'NC';
      checkboxResults[field].confidence = 0.95; // Alta confianza: verificación activa lo rechazó
      checkboxResults[field].needsHumanReview = false;
    }
  }

  // Subir confianza de campos confirmados por verificación
  for (const field of verificationResult.verified) {
    if (checkboxResults[field]) {
      checkboxResults[field].confidence = 0.95; // Confirmado por doble pasada
    }
  }

  // Post-procesamiento: lugar_trabajo → provincia oficial en MAYÚSCULAS
  // Mapeo: todas las variantes (castellano, sin tilde, euskera, gallego, catalán, IATA) → provincia oficial
  const PROVINCIA_ALIASES: Record<string, string> = {
    // 52 provincias oficiales + Ceuta y Melilla
    'alava': 'ALAVA', 'álava': 'ALAVA', 'araba': 'ALAVA',
    'albacete': 'ALBACETE',
    'alicante': 'ALICANTE', 'alacant': 'ALICANTE',
    'almeria': 'ALMERIA', 'almería': 'ALMERIA',
    'asturias': 'ASTURIAS', 'oviedo': 'ASTURIAS',
    'avila': 'AVILA', 'ávila': 'AVILA',
    'badajoz': 'BADAJOZ',
    'barcelona': 'BARCELONA',
    'burgos': 'BURGOS',
    'caceres': 'CACERES', 'cáceres': 'CACERES',
    'cadiz': 'CADIZ', 'cádiz': 'CADIZ',
    'cantabria': 'CANTABRIA', 'santander': 'CANTABRIA',
    'castellon': 'CASTELLON', 'castellón': 'CASTELLON', 'castelló': 'CASTELLON',
    'ceuta': 'CEUTA',
    'ciudad real': 'CIUDAD REAL',
    'cordoba': 'CORDOBA', 'córdoba': 'CORDOBA',
    'cuenca': 'CUENCA',
    'girona': 'GIRONA', 'gerona': 'GIRONA',
    'granada': 'GRANADA',
    'guadalajara': 'GUADALAJARA',
    'guipuzcoa': 'GUIPUZCOA', 'guipúzcoa': 'GUIPUZCOA', 'gipuzkoa': 'GUIPUZCOA',
    'huelva': 'HUELVA',
    'huesca': 'HUESCA', 'osca': 'HUESCA',
    'islas baleares': 'ISLAS BALEARES', 'illes balears': 'ISLAS BALEARES', 'baleares': 'ISLAS BALEARES', 'balears': 'ISLAS BALEARES', 'mallorca': 'ISLAS BALEARES', 'palma': 'ISLAS BALEARES', 'palma de mallorca': 'ISLAS BALEARES',
    'jaen': 'JAEN', 'jaén': 'JAEN',
    'la coruña': 'LA CORUNA', 'a coruña': 'LA CORUNA', 'coruña': 'LA CORUNA', 'coruna': 'LA CORUNA', 'a coruña': 'LA CORUNA',
    'la rioja': 'LA RIOJA', 'rioja': 'LA RIOJA', 'logroño': 'LA RIOJA', 'logrono': 'LA RIOJA',
    'las palmas': 'LAS PALMAS', 'gran canaria': 'LAS PALMAS', 'las palmas de gran canaria': 'LAS PALMAS',
    'leon': 'LEON', 'león': 'LEON',
    'lleida': 'LLEIDA', 'lerida': 'LLEIDA', 'lérida': 'LLEIDA',
    'lugo': 'LUGO',
    'madrid': 'MADRID',
    'malaga': 'MALAGA', 'málaga': 'MALAGA',
    'melilla': 'MELILLA',
    'murcia': 'MURCIA',
    'navarra': 'NAVARRA', 'nafarroa': 'NAVARRA',
    'ourense': 'OURENSE', 'orense': 'OURENSE',
    'palencia': 'PALENCIA',
    'pontevedra': 'PONTEVEDRA', 'vigo': 'PONTEVEDRA',
    'salamanca': 'SALAMANCA',
    'segovia': 'SEGOVIA',
    'sevilla': 'SEVILLA',
    'soria': 'SORIA',
    'tarragona': 'TARRAGONA',
    'santa cruz de tenerife': 'SANTA CRUZ DE TENERIFE', 'tenerife': 'SANTA CRUZ DE TENERIFE', 'santa cruz': 'SANTA CRUZ DE TENERIFE',
    'teruel': 'TERUEL',
    'toledo': 'TOLEDO',
    'valencia': 'VALENCIA', 'valència': 'VALENCIA',
    'valladolid': 'VALLADOLID',
    'vizcaya': 'VIZCAYA', 'bizkaia': 'VIZCAYA', 'bilbao': 'VIZCAYA',
    'zamora': 'ZAMORA',
    'zaragoza': 'ZARAGOZA', 'saragossa': 'ZARAGOZA',
  };

  const lugarRaw = String(extractedData.lugar_trabajo || 'NC').trim();
  if (lugarRaw !== 'NC' && lugarRaw !== '') {
    const lugarLower = lugarRaw.toLowerCase();
    // 1. Coincidencia directa del texto completo
    if (PROVINCIA_ALIASES[lugarLower]) {
      extractedData.lugar_trabajo = PROVINCIA_ALIASES[lugarLower];
    } else {
      // 2. Buscar fragmentos de 4, 3, 2, 1 palabras
      const words = lugarRaw.split(/[\s,\/\-]+/).filter(w => w.length > 0);
      let found = false;
      for (let len = Math.min(4, words.length); len >= 1 && !found; len--) {
        for (let i = 0; i <= words.length - len && !found; i++) {
          const candidate = words.slice(i, i + len).join(' ').toLowerCase();
          if (PROVINCIA_ALIASES[candidate]) {
            extractedData.lugar_trabajo = PROVINCIA_ALIASES[candidate];
            found = true;
          }
        }
      }
      if (!found) {
        extractedData.lugar_trabajo = 'NC';
      }
    }
  } else {
    extractedData.lugar_trabajo = 'NC';
  }

  // Alias de campos: Gemini usa "titulacion" y "tamaño_empresa", el sistema espera "titulacion_codigo" y "tamano_empresa"
  if (extractedData.titulacion !== undefined && extractedData.titulacion_codigo === undefined) {
    extractedData.titulacion_codigo = extractedData.titulacion;
  }
  if (extractedData['tamaño_empresa'] !== undefined && extractedData.tamano_empresa === undefined) {
    extractedData.tamano_empresa = extractedData['tamaño_empresa'];
  }

  // Post-procesamiento: valoracion_7_x según modalidad
  const modalidad = String(extractedData.modalidad || '').toLowerCase();
  const esPresencial = modalidad.includes('presencial') && !modalidad.includes('mixta');
  if (esPresencial) {
    extractedData.valoracion_7_1 = 'NA';
    extractedData.valoracion_7_2 = 'NA';
  }

  // ========================================
  // PASO 4: Calcular confianza
  // ========================================
  const totalFields = Object.keys(checkboxResults).length;
  // Reemplazar cualquier null residual por "NC"
  for (const key of Object.keys(extractedData)) {
    if (extractedData[key] === null || extractedData[key] === undefined) {
      extractedData[key] = 'NC';
    }
  }

  // Si es landscape, añadir a fieldsNeedingReview
  if (isLandscape) {
    fieldsNeedingReview.push('FORMULARIO_HORIZONTAL');
    extractedData._landscape = true;
  }

  // Log resumen de verificación anti-alucinación
  if (!verificationResult.skipped) {
    console.log(`[anti-hallucination] RESUMEN: ${verificationResult.verified.length} confirmados, ${verificationResult.changed.length} revertidos a NC`);
    if (verificationResult.changed.length > 0) {
      console.log(`[anti-hallucination] Campos revertidos: ${verificationResult.changed.join(', ')}`);
    }
  }

  const fieldsWithValue = Object.values(checkboxResults).filter(r => r.value !== 'NC').length;
  const overallConfidence = totalFields > 0 ? Math.max(0.5, fieldsWithValue / totalFields) : 0.5;

  const processingTimeMs = Date.now() - startTime;
  console.log(`[hybridExtractor] Completado en ${processingTimeMs}ms, confianza: ${(overallConfidence * 100).toFixed(1)}%`);

  // Log resumen de valoraciones para diagnóstico
  for (const field of valuationFields) {
    console.log(`[Gemini] ${field}: ${extractedData[field]}`);
  }
  for (const field of binaryFields) {
    console.log(`[Gemini] ${field}: ${extractedData[field]}`);
  }

  return {
    extractedData,
    checkboxResults,
    textResults: extractedData,
    overallConfidence,
    fieldsNeedingReview,
    method: 'hybrid_cv_gemini',
    localizationMethod: 'gemini_direct',
    processingTimeMs,
  };
}
