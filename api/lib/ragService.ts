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
const GENERATION_MODEL = 'gemini-2.0-flash';

const DEFAULT_CHUNK_SIZE = 500; // palabras
const DEFAULT_CHUNK_OVERLAP = 50;
const DEFAULT_TOP_K = 5;

// ============================================================================
// INTERFACES
// ============================================================================

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
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY o GOOGLE_API_KEY no configurada');
  }

  try {
    // API REST v1beta para gemini-embedding-001
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
    console.error('[RAG] Error generando embedding:', error.message);
    throw error;
  }
}

/**
 * Genera embeddings en batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 10;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(text => generateEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);

    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
 * Chunking inteligente que respeta oraciones
 */
export function chunkTextSmart(
  text: string,
  maxChunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  if (!text || text.trim().length === 0) return [];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;

    if (currentWordCount + sentenceWords > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));

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
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

// ============================================================================
// PGVECTOR OPERATIONS
// ============================================================================

/**
 * Inserta embeddings en PostgreSQL
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
  for (const item of embeddings) {
    const vectorStr = `[${item.embedding.join(',')}]`;

    await sql`
      INSERT INTO rag_embeddings (
        document_id, user_id, document_name, chunk_index, chunk_text, embedding, metadata
      ) VALUES (
        ${item.documentId}::uuid,
        ${item.userId}::uuid,
        ${item.documentName},
        ${item.chunkIndex},
        ${item.chunkText},
        ${vectorStr}::vector,
        ${item.metadata ? JSON.stringify(item.metadata) : null}::jsonb
      )
      ON CONFLICT (document_id, chunk_index)
      DO UPDATE SET
        chunk_text = EXCLUDED.chunk_text,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata
    `;
  }
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

  return result.rows.map(row => ({
    chunk: {
      id: row.id,
      text: row.chunk_text,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
    },
    score: parseFloat(row.similarity) || 0,
    documentName: row.document_name,
    documentUrl: row.pdf_blob_url || undefined,
    fileType: row.file_type || undefined,
  }));
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
 * Genera respuesta con contexto
 */
export async function generateAnswer(
  query: string,
  context: RAGSearchResult[],
  language: string = 'es'
): Promise<RAGAnswer> {
  const client = getGenAIClient();
  const langConfig = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG['es'];

  if (context.length === 0) {
    return {
      answer: langConfig.noDocsMessage,
      sources: [],
      confidence: 0,
    };
  }

  const contextParts = context.map((result, idx) => {
    const sourceRef = `[${langConfig.sourceLabel} ${idx + 1}: ${result.documentName || result.chunk.documentId}]`;
    return `${sourceRef}\n${result.chunk.text}`;
  });
  const contextString = contextParts.join('\n\n---\n\n');

  const systemPrompt = `Eres un asistente experto que responde preguntas basandose UNICAMENTE en los documentos proporcionados.

REGLAS:
1. Responde SOLO con informacion de los documentos
2. Si no hay informacion suficiente, dilo claramente
3. Cita las fuentes usando [${langConfig.sourceLabel} X]
4. Se preciso y conciso
5. ${langConfig.promptInstruction}

DOCUMENTOS:
${contextString}`;

  try {
    const result = await client.models.generateContent({
      model: GENERATION_MODEL,
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: `Pregunta: ${query}` }] }
      ],
      config: {
        temperature: 0.3,
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
 * Pipeline completo: embedding -> busqueda -> respuesta
 */
export async function ragQuery(
  query: string,
  userId: string,
  filters?: {
    documentIds?: string[];
    folderId?: string;
  },
  topK: number = DEFAULT_TOP_K,
  language: string = 'es'
): Promise<RAGAnswer> {
  console.log(`[RAG] Consulta usuario ${userId}: "${query.substring(0, 50)}..." [${language}]${filters?.folderId ? ` (carpeta: ${filters.folderId})` : ''}`);

  const queryEmbedding = await generateEmbedding(query);
  const searchResults = await searchSimilar(
    queryEmbedding,
    userId,
    topK,
    filters?.documentIds,
    filters?.folderId
  );
  const answer = await generateAnswer(query, searchResults, language);

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
  console.log(`[RAG] Ingestando documento: ${documentId}`);

  const chunks = chunkTextSmart(text);
  console.log(`[RAG] ${chunks.length} chunks creados`);

  if (chunks.length === 0) {
    return { chunksCreated: 0, vectorsUploaded: 0 };
  }

  const embeddings = await generateEmbeddings(chunks);

  const embeddingsData = chunks.map((chunkText, index) => ({
    documentId,
    userId,
    documentName,
    chunkIndex: index,
    chunkText,
    embedding: embeddings[index],
    metadata,
  }));

  await upsertEmbeddings(embeddingsData);

  // Guardar referencia en rag_document_chunks
  for (let i = 0; i < chunks.length; i++) {
    await sql`
      INSERT INTO rag_document_chunks (document_id, chunk_index, chunk_text, pinecone_id)
      VALUES (${documentId}::uuid, ${i}, ${chunks[i]}, ${`${documentId}_chunk_${i}`})
      ON CONFLICT (document_id, chunk_index) DO UPDATE
      SET chunk_text = EXCLUDED.chunk_text
    `;
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
