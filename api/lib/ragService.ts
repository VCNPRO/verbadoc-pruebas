/**
 * RAG SERVICE - "Preguntale al Documento"
 * api/lib/ragService.ts
 *
 * Retrieval-Augmented Generation usando pgvector (PostgreSQL)
 * Sin dependencias externas - todo en Vercel Postgres
 *
 * GDPR/ENS Compliant - Datos en EU
 */

import { sql } from '@vercel/postgres';
import { GoogleGenAI } from '@google/genai';

// ============================================================================
// CONFIGURATION
// ============================================================================

const EMBEDDING_MODEL = 'gemini-embedding-001'; // Gemini embedding (768 dims)
const DEFAULT_GENERATION_MODEL = 'gemini-2.0-flash';

const DEFAULT_CHUNK_SIZE = 500; // palabras
const DEFAULT_CHUNK_OVERLAP = 50;
const DEFAULT_TOP_K = 5;

// Modelos Gemini disponibles para generación
export const AVAILABLE_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview',
  'gemini-1.5-pro',
] as const;

export type AvailableModel = typeof AVAILABLE_MODELS[number];

// ============================================================================
// INTERFACES
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RAGConfig {
  temperature: number;          // 0.0-1.0 (default 0.3)
  topK: number;                 // 1-10 (default 5)
  similarityThreshold: number;  // 0.0-1.0 (default 0.0 = sin filtro)
  model: string;                // gemini-2.0-flash | gemini-2.5-flash-preview | gemini-1.5-pro
  chatHistory?: ChatMessage[];  // últimos 5 pares de mensajes
}

export interface RAGChunk {
  id: string;
  text: string;
  documentId: string;
  chunkIndex: number;
  metadata?: Record<string, any>;
}

export interface RAGSearchResult {
  chunk: RAGChunk;
  score: number;
  documentName?: string;
  documentUrl?: string;
  fileType?: string;
}

export interface RAGAnswer {
  answer: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    snippet: string;
    score: number;
    documentUrl?: string;
    fileType?: string;
    page?: number;
  }>;
  confidence: number;
  tokensUsed?: number;
}

// ============================================================================
// GEMINI CLIENT
// ============================================================================

let genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY o GOOGLE_API_KEY no configurada');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Genera vector embedding con Gemini API REST (768 dimensiones)
 * Modelo: gemini-embedding-001 (dimensiones: 768, 1536 o 3072)
 * Incluye retry con backoff exponencial para rate limits (429)
 */
export async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY o GOOGLE_API_KEY no configurada');
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: 768
          })
        }
      );

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (attempt + 1);
        console.warn(`[RAG] Rate limit 429, esperando ${waitMs}ms (intento ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[RAG] Error API embeddings:', errorData);
        throw new Error(errorData.error?.message || JSON.stringify(errorData));
      }

      const data = await response.json();
      const embedding = data.embedding?.values;

      if (!embedding || embedding.length === 0) {
        throw new Error('No se genero embedding');
      }

      return embedding;
    } catch (error: any) {
      if (attempt === retries - 1) {
        console.error('[RAG] Error generando embedding (sin reintentos):', error.message);
        throw error;
      }
      const backoff = 500 * Math.pow(2, attempt);
      console.warn(`[RAG] Error embedding, reintentando en ${backoff}ms (intento ${attempt + 1}/${retries}):`, error.message);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }

  throw new Error('generateEmbedding: reintentos agotados');
}

/**
 * Genera embeddings en batch con delay adaptativo y retry en rate limit
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 30;
  let delay = 50;
  let batchRetries = 0;
  const maxBatchRetries = 5;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const batchPromises = batch.map(text => generateEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
      delay = 50;
      batchRetries = 0;
    } catch (e: any) {
      if ((e.message?.includes('429') || e.message?.includes('rate')) && batchRetries < maxBatchRetries) {
        batchRetries++;
        console.warn(`[RAG] Rate limit en batch ${Math.floor(i / batchSize)}, reintento ${batchRetries}/${maxBatchRetries}, esperando 2s...`);
        delay = 2000;
        i -= batchSize;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw e;
    }

    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return embeddings;
}

// ============================================================================
// TEXT CHUNKING
// ============================================================================

/**
 * Divide texto en chunks con overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  if (!text || text.trim().length === 0) return [];

  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const words = normalizedText.split(' ');

  if (words.length <= chunkSize) return [normalizedText];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkSize, words.length);
    const chunk = words.slice(startIndex, endIndex).join(' ');
    chunks.push(chunk);
    startIndex += chunkSize - overlap;
    if (startIndex <= 0) break;
  }

  return chunks;
}

/**
 * Chunking inteligente que respeta oraciones y detecta páginas.
 * Retorna chunks con metadata de página cuando hay marcadores de página.
 * Marcadores soportados: \f (form feed), "--- Página X ---", "Page X", "[Página X]"
 */
export interface ChunkWithPage {
  text: string;
  page?: number;
}

export function chunkTextSmart(
  text: string,
  maxChunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  return chunkTextSmartWithPages(text, maxChunkSize, overlap).map(c => c.text);
}

export function chunkTextSmartWithPages(
  text: string,
  maxChunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): ChunkWithPage[] {
  if (!text || text.trim().length === 0) return [];

  // Detectar y dividir por páginas si hay marcadores
  const pageRegex = /(?:\f|---\s*P[aá]gina\s+(\d+)\s*---|(?:^|\n)\[P[aá]gina\s+(\d+)\]|\bPage\s+(\d+)\b(?:\s*[-—]|$))/gi;
  const hasPageMarkers = pageRegex.test(text);

  // Dividir texto en segmentos por página
  interface PageSegment { text: string; page: number; }
  const pageSegments: PageSegment[] = [];

  if (hasPageMarkers) {
    // Reset regex
    pageRegex.lastIndex = 0;
    let lastIndex = 0;
    let currentPage = 1;
    let match;

    while ((match = pageRegex.exec(text)) !== null) {
      const beforeText = text.substring(lastIndex, match.index).trim();
      if (beforeText) {
        pageSegments.push({ text: beforeText, page: currentPage });
      }
      // Extraer número de página del marcador
      const pageNum = parseInt(match[1] || match[2] || match[3] || '0');
      if (pageNum > 0) currentPage = pageNum;
      else currentPage++;
      lastIndex = match.index + match[0].length;
    }
    // Último segmento
    const remaining = text.substring(lastIndex).trim();
    if (remaining) {
      pageSegments.push({ text: remaining, page: currentPage });
    }
  } else {
    pageSegments.push({ text: text, page: 1 });
  }

  // Ahora hacer chunking respetando oraciones, manteniendo la página
  const chunks: ChunkWithPage[] = [];

  for (const segment of pageSegments) {
    const sentences = segment.text.split(/(?<=[.!?])\s+/);
    let currentChunk: string[] = [];
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;

      if (currentWordCount + sentenceWords > maxChunkSize && currentChunk.length > 0) {
        chunks.push({ text: currentChunk.join(' '), page: hasPageMarkers ? segment.page : undefined });

        const overlapSentences: string[] = [];
        let overlapWords = 0;
        for (let i = currentChunk.length - 1; i >= 0 && overlapWords < overlap; i--) {
          overlapSentences.unshift(currentChunk[i]);
          overlapWords += currentChunk[i].split(/\s+/).length;
        }

        currentChunk = overlapSentences;
        currentWordCount = overlapWords;
      }

      currentChunk.push(sentence);
      currentWordCount += sentenceWords;
    }

    if (currentChunk.length > 0) {
      chunks.push({ text: currentChunk.join(' '), page: hasPageMarkers ? segment.page : undefined });
    }
  }

  return chunks;
}

// ============================================================================
// PGVECTOR OPERATIONS
// ============================================================================

/**
 * Inserta embeddings en PostgreSQL con bulk INSERT multi-fila
 * Procesa en bloques de 25 para no exceder limites de parametros
 */
export async function upsertEmbeddings(
  embeddings: Array<{
    documentId: string;
    userId: string;
    documentName: string;
    chunkIndex: number;
    chunkText: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }>
): Promise<void> {
  const BATCH = 25;
  const PARAMS_PER_ROW = 7;

  for (let i = 0; i < embeddings.length; i += BATCH) {
    const batch = embeddings.slice(i, i + BATCH);
    const values: any[] = [];
    const valueClauses: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const offset = j * PARAMS_PER_ROW;
      valueClauses.push(
        `($${offset + 1}::uuid, $${offset + 2}::uuid, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::vector, $${offset + 7}::jsonb)`
      );
      values.push(
        item.documentId,
        item.userId,
        item.documentName,
        item.chunkIndex,
        item.chunkText,
        `[${item.embedding.join(',')}]`,
        item.metadata ? JSON.stringify(item.metadata) : null
      );
    }

    const queryText = `
      INSERT INTO rag_embeddings (
        document_id, user_id, document_name, chunk_index, chunk_text, embedding, metadata
      ) VALUES ${valueClauses.join(', ')}
      ON CONFLICT (document_id, chunk_index)
      DO UPDATE SET
        chunk_text = EXCLUDED.chunk_text,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata
    `;

    await sql.query(queryText, values);
  }

  console.log(`[RAG] Bulk upsert: ${embeddings.length} embeddings en ${Math.ceil(embeddings.length / BATCH)} queries`);
}

/**
 * Busca embeddings similares en PostgreSQL
 */
export async function searchSimilar(
  queryEmbedding: number[],
  userId: string,
  topK: number = DEFAULT_TOP_K,
  documentIds?: string[],
  folderId?: string
): Promise<RAGSearchResult[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  let result;

  if (folderId) {
    // Filtrar por carpeta: buscar embeddings de documentos que pertenecen a la carpeta
    result = await sql`
      SELECT
        re.id,
        re.document_id,
        re.document_name,
        re.chunk_index,
        re.chunk_text,
        re.metadata,
        er.pdf_blob_url,
        er.file_type,
        1 - (re.embedding <=> ${vectorStr}::vector) as similarity
      FROM rag_embeddings re
      INNER JOIN extraction_results er ON er.id = re.document_id
      WHERE re.user_id = ${userId}::uuid
        AND er.folder_id = ${folderId}::uuid
      ORDER BY re.embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;
  } else if (documentIds && documentIds.length > 0) {
    result = await sql`
      SELECT
        re.id,
        re.document_id,
        re.document_name,
        re.chunk_index,
        re.chunk_text,
        re.metadata,
        er.pdf_blob_url,
        er.file_type,
        1 - (re.embedding <=> ${vectorStr}::vector) as similarity
      FROM rag_embeddings re
      LEFT JOIN extraction_results er ON er.id = re.document_id
      WHERE re.user_id = ${userId}::uuid
        AND re.document_id = ANY(${documentIds}::uuid[])
      ORDER BY re.embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;
  } else {
    result = await sql`
      SELECT
        re.id,
        re.document_id,
        re.document_name,
        re.chunk_index,
        re.chunk_text,
        re.metadata,
        er.pdf_blob_url,
        er.file_type,
        1 - (re.embedding <=> ${vectorStr}::vector) as similarity
      FROM rag_embeddings re
      LEFT JOIN extraction_results er ON er.id = re.document_id
      WHERE re.user_id = ${userId}::uuid
      ORDER BY re.embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;
  }

  return result.rows.map(row => {
    const meta = row.metadata || {};
    return {
      chunk: {
        id: row.id,
        text: row.chunk_text,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        metadata: meta,
      },
      score: parseFloat(row.similarity) || 0,
      documentName: row.document_name,
      documentUrl: row.pdf_blob_url || undefined,
      fileType: row.file_type || undefined,
    };
  });
}

/**
 * Elimina embeddings de un documento
 */
export async function deleteByDocumentId(documentId: string): Promise<void> {
  await sql`DELETE FROM rag_embeddings WHERE document_id = ${documentId}::uuid`;
  await sql`DELETE FROM rag_document_chunks WHERE document_id = ${documentId}::uuid`;
  console.log(`[RAG] Eliminado documento: ${documentId}`);
}

/**
 * Elimina embeddings de un usuario (RGPD)
 */
export async function deleteByUserId(userId: string): Promise<void> {
  await sql`DELETE FROM rag_embeddings WHERE user_id = ${userId}::uuid`;
  console.log(`[RAG] Eliminados embeddings del usuario: ${userId}`);
}

// ============================================================================
// QUERY REWRITING (contexto conversacional)
// ============================================================================

/**
 * Reescribe la query del usuario para que sea autónoma usando el historial de chat.
 * Solo se activa si hay historial (>0 mensajes). Usa el modelo más rápido.
 */
async function rewriteQuery(query: string, chatHistory: ChatMessage[]): Promise<string> {
  if (!chatHistory || chatHistory.length === 0) {
    return query;
  }

  const client = getGenAIClient();

  const historyText = chatHistory
    .slice(-10) // máx 5 pares
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content.substring(0, 300)}`)
    .join('\n');

  try {
    const result = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Dado este historial de conversación, reescribe la última pregunta del usuario para que sea completamente autónoma y se entienda sin el historial. Si la pregunta ya es autónoma, devuélvela tal cual. Responde SOLO con la pregunta reescrita, sin explicaciones.

HISTORIAL:
${historyText}

ÚLTIMA PREGUNTA: ${query}

PREGUNTA REESCRITA:`
          }]
        }
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 256,
      }
    });

    const rewritten = result.text?.trim();
    if (rewritten && rewritten.length > 0 && rewritten.length < 2000) {
      console.log(`[RAG] Query reescrita: "${query.substring(0, 50)}..." → "${rewritten.substring(0, 50)}..."`);
      return rewritten;
    }
    return query;
  } catch (error: any) {
    console.warn('[RAG] Error en query rewriting, usando query original:', error.message);
    return query;
  }
}

// ============================================================================
// ANSWER GENERATION
// ============================================================================

// Configuración de idiomas para respuestas
const LANGUAGE_CONFIG: Record<string, { noDocsMessage: string; promptInstruction: string; sourceLabel: string }> = {
  es: { noDocsMessage: 'No se encontraron documentos relevantes para responder a tu pregunta.', promptInstruction: 'Responde en español.', sourceLabel: 'Fuente' },
  ca: { noDocsMessage: 'No s\'han trobat documents rellevants per respondre a la teva pregunta.', promptInstruction: 'Respon en català.', sourceLabel: 'Font' },
  gl: { noDocsMessage: 'Non se atoparon documentos relevantes para responder á túa pregunta.', promptInstruction: 'Responde en galego.', sourceLabel: 'Fonte' },
  eu: { noDocsMessage: 'Ez da dokumentu garrantzitsurik aurkitu zure galderari erantzuteko.', promptInstruction: 'Erantzun euskaraz.', sourceLabel: 'Iturria' },
  pt: { noDocsMessage: 'Não foram encontrados documentos relevantes para responder à sua pergunta.', promptInstruction: 'Responda em português.', sourceLabel: 'Fonte' },
  fr: { noDocsMessage: 'Aucun document pertinent n\'a été trouvé pour répondre à votre question.', promptInstruction: 'Répondez en français.', sourceLabel: 'Source' },
  en: { noDocsMessage: 'No relevant documents found to answer your question.', promptInstruction: 'Respond in English.', sourceLabel: 'Source' },
  it: { noDocsMessage: 'Non sono stati trovati documenti rilevanti per rispondere alla tua domanda.', promptInstruction: 'Rispondi in italiano.', sourceLabel: 'Fonte' },
  de: { noDocsMessage: 'Es wurden keine relevanten Dokumente gefunden, um Ihre Frage zu beantworten.', promptInstruction: 'Antworten Sie auf Deutsch.', sourceLabel: 'Quelle' },
};

/**
 * Genera respuesta con contexto, modelo dinámico y memoria conversacional
 */
export async function generateAnswer(
  query: string,
  context: RAGSearchResult[],
  language: string = 'es',
  config?: Partial<RAGConfig>
): Promise<RAGAnswer> {
  const client = getGenAIClient();
  const langConfig = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG['es'];
  const temperature = config?.temperature ?? 0.3;
  const model = config?.model && AVAILABLE_MODELS.includes(config.model as AvailableModel)
    ? config.model
    : DEFAULT_GENERATION_MODEL;

  if (context.length === 0) {
    return {
      answer: langConfig.noDocsMessage,
      sources: [],
      confidence: 0,
    };
  }

  const contextParts = context.map((result, idx) => {
    const docName = result.documentName || result.chunk.documentId;
    const page = result.chunk.metadata?.page;
    const pageRef = page ? ` - p.${page}` : '';
    const sourceRef = `[${langConfig.sourceLabel} ${idx + 1}: ${docName}${pageRef}]`;
    return `${sourceRef}\n${result.chunk.text}`;
  });
  const contextString = contextParts.join('\n\n---\n\n');

  const systemPrompt = `Eres un asistente experto, veraz y proactivo que responde preguntas basándose ÚNICAMENTE en los documentos proporcionados.

PERSONA: Eres un analista documental profesional. Tu objetivo es dar respuestas precisas, útiles y bien fundamentadas.

REGLAS ESTRICTAS:
1. Responde SOLO con información contenida en los documentos proporcionados.
2. VERACIDAD: Si la información NO está en los documentos, responde exactamente: "No tengo información sobre esto en los documentos proporcionados. ¿Te gustaría que busque sobre un tema relacionado?"
3. CLARIFICACIÓN: Si la pregunta es ambigua o demasiado vaga, pide aclaración antes de responder.
4. CITAS OBLIGATORIAS: Siempre cita el nombre del archivo fuente entre corchetes con su número de fuente y página si está disponible, ej: [${langConfig.sourceLabel} 1: NombreArchivo.pdf - p.3]. Cada afirmación debe tener su cita.
5. Sé preciso, estructurado y conciso. Usa listas o tablas si mejoran la claridad.
6. ${langConfig.promptInstruction}

DOCUMENTOS DISPONIBLES:
${contextString}`;

  // Construir mensajes incluyendo historial conversacional
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    { role: 'user', parts: [{ text: systemPrompt }] },
  ];

  // Añadir historial de chat si existe
  if (config?.chatHistory && config.chatHistory.length > 0) {
    for (const msg of config.chatHistory.slice(-10)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  // Pregunta actual
  contents.push({ role: 'user', parts: [{ text: `Pregunta: ${query}` }] });

  try {
    const result = await client.models.generateContent({
      model,
      contents,
      config: {
        temperature,
        maxOutputTokens: 1024,
      }
    });

    const answer = result.text || '';
    const avgScore = context.reduce((sum, r) => sum + r.score, 0) / context.length;

    return {
      answer,
      sources: context.map((result, idx) => ({
        documentId: result.chunk.documentId,
        documentName: result.documentName || result.chunk.documentId,
        chunkIndex: result.chunk.chunkIndex,
        snippet: result.chunk.text.substring(0, 200) + '...',
        score: Math.round(result.score * 100) / 100,
        documentUrl: result.documentUrl,
        fileType: result.fileType,
        page: result.chunk.metadata?.page || undefined,
      })),
      confidence: Math.round(avgScore * 100) / 100,
      tokensUsed: result.usageMetadata?.totalTokenCount,
    };
  } catch (error: any) {
    console.error('[RAG] Error generando respuesta:', error.message);
    throw error;
  }
}

// ============================================================================
// FULL RAG PIPELINE
// ============================================================================

/**
 * Pipeline completo: query rewriting -> embedding -> búsqueda -> filtro threshold -> respuesta
 */
export async function ragQuery(
  query: string,
  userId: string,
  filters?: {
    documentIds?: string[];
    folderId?: string;
  },
  topK: number = DEFAULT_TOP_K,
  language: string = 'es',
  config?: Partial<RAGConfig>
): Promise<RAGAnswer> {
  const effectiveTopK = config?.topK ?? topK;
  const similarityThreshold = config?.similarityThreshold ?? 0.0;

  console.log(`[RAG] Consulta usuario ${userId}: "${query.substring(0, 50)}..." [${language}] modelo=${config?.model || DEFAULT_GENERATION_MODEL} temp=${config?.temperature ?? 0.3}${filters?.folderId ? ` (carpeta: ${filters.folderId})` : ''}`);

  // Query rewriting si hay historial de chat
  const effectiveQuery = config?.chatHistory && config.chatHistory.length > 0
    ? await rewriteQuery(query, config.chatHistory)
    : query;

  const queryEmbedding = await generateEmbedding(effectiveQuery);
  let searchResults = await searchSimilar(
    queryEmbedding,
    userId,
    effectiveTopK,
    filters?.documentIds,
    filters?.folderId
  );

  // Filtrar por similarity threshold si está configurado
  if (similarityThreshold > 0) {
    const before = searchResults.length;
    searchResults = searchResults.filter(r => r.score >= similarityThreshold);
    if (before !== searchResults.length) {
      console.log(`[RAG] Threshold ${similarityThreshold}: ${before} → ${searchResults.length} resultados`);
    }
  }

  const answer = await generateAnswer(effectiveQuery, searchResults, language, config);

  return answer;
}

// ============================================================================
// DOCUMENT INGESTION
// ============================================================================

/**
 * Ingesta un documento al sistema RAG
 */
export async function ingestDocument(
  documentId: string,
  documentName: string,
  text: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<{ chunksCreated: number; vectorsUploaded: number }> {
  console.log(`[RAG] Ingestando documento: ${documentId} (${documentName})`);

  const chunksWithPages = chunkTextSmartWithPages(text);
  const chunks = chunksWithPages.map(c => c.text);
  console.log(`[RAG] ${chunks.length} chunks creados`);

  if (chunks.length === 0) {
    return { chunksCreated: 0, vectorsUploaded: 0 };
  }

  const embeddings = await generateEmbeddings(chunks);

  const embeddingsData = chunksWithPages.map((chunk, index) => ({
    documentId,
    userId,
    documentName,
    chunkIndex: index,
    chunkText: chunk.text,
    embedding: embeddings[index],
    metadata: {
      ...metadata,
      documentCode: documentName,
      ...(chunk.page ? { page: chunk.page } : {}),
    },
  }));

  await upsertEmbeddings(embeddingsData);

  // Guardar referencia en rag_document_chunks (bulk insert)
  const CHUNK_BATCH = 50;
  const CHUNK_PARAMS_PER_ROW = 4;
  for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
    const batch = chunks.slice(i, i + CHUNK_BATCH);
    const values: any[] = [];
    const valueClauses: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const chunkIdx = i + j;
      const offset = j * CHUNK_PARAMS_PER_ROW;
      valueClauses.push(
        `($${offset + 1}::uuid, $${offset + 2}, $${offset + 3}, $${offset + 4})`
      );
      values.push(
        documentId,
        chunkIdx,
        batch[j],
        `${documentId}_chunk_${chunkIdx}`
      );
    }

    await sql.query(
      `INSERT INTO rag_document_chunks (document_id, chunk_index, chunk_text, pinecone_id)
       VALUES ${valueClauses.join(', ')}
       ON CONFLICT (document_id, chunk_index) DO UPDATE
       SET chunk_text = EXCLUDED.chunk_text`,
      values
    );
  }

  console.log(`[RAG] Documento ${documentId} ingestado: ${chunks.length} chunks`);

  return {
    chunksCreated: chunks.length,
    vectorsUploaded: embeddings.length,
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log de consultas RAG (RGPD/ENS)
 */
export async function logRagQuery(
  userId: string,
  query: string,
  response: string,
  documentIds: string[],
  confidenceScore: number,
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  try {
    const docIdsStr = documentIds.length > 0 ? `{${documentIds.join(',')}}` : null;

    const result = await sql`
      INSERT INTO rag_queries (
        user_id, query, response, document_ids, confidence_score, ip_address, user_agent
      ) VALUES (
        ${userId}::uuid,
        ${query},
        ${response},
        ${docIdsStr}::uuid[],
        ${confidenceScore},
        ${ipAddress || null}::inet,
        ${userAgent || null}
      )
      RETURNING id
    `;

    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[RAG] Error logging query:', error);
    return null;
  }
}

/**
 * Historial de consultas de un usuario
 */
export async function getRagQueryHistory(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  const result = await sql`
    SELECT id, user_id, query, response, document_ids, confidence_score, created_at
    FROM rag_queries
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows;
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Estadisticas del indice RAG
 */
export async function getRagStats(userId?: string): Promise<{
  totalEmbeddings: number;
  totalDocuments: number;
  totalChunks: number;
}> {
  if (userId) {
    const result = await sql`
      SELECT
        COUNT(*) as total_embeddings,
        COUNT(DISTINCT document_id) as total_documents
      FROM rag_embeddings
      WHERE user_id = ${userId}::uuid
    `;

    return {
      totalEmbeddings: parseInt(result.rows[0]?.total_embeddings || '0'),
      totalDocuments: parseInt(result.rows[0]?.total_documents || '0'),
      totalChunks: parseInt(result.rows[0]?.total_embeddings || '0'),
    };
  }

  const result = await sql`
    SELECT
      COUNT(*) as total_embeddings,
      COUNT(DISTINCT document_id) as total_documents
    FROM rag_embeddings
  `;

  return {
    totalEmbeddings: parseInt(result.rows[0]?.total_embeddings || '0'),
    totalDocuments: parseInt(result.rows[0]?.total_documents || '0'),
    totalChunks: parseInt(result.rows[0]?.total_embeddings || '0'),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateEmbedding,
  generateEmbeddings,
  chunkText,
  chunkTextSmart,
  upsertEmbeddings,
  searchSimilar,
  deleteByDocumentId,
  deleteByUserId,
  generateAnswer,
  ragQuery,
  ingestDocument,
  logRagQuery,
  getRagQueryHistory,
  getRagStats,
};
