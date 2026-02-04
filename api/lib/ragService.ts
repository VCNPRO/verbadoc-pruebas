/**
 * RAG SERVICE - "Preguntale al Documento"
 * api/lib/ragService.ts
 *
 * Retrieval-Augmented Generation service for semantic document search
 * Integrates Pinecone vector database with Gemini embeddings and generation
 *
 * GDPR/ENS Compliant - All processing in EU
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { sql } from '@vercel/postgres';
import { GoogleGenAI } from '@google/genai';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'verbadocpro-rag';
const EMBEDDING_MODEL = 'text-embedding-004'; // Gemini embedding model (768 dimensions)
const GENERATION_MODEL = 'gemini-2.0-flash'; // Fast generation model

// Chunk configuration for optimal retrieval
const DEFAULT_CHUNK_SIZE = 500; // words
const DEFAULT_CHUNK_OVERLAP = 50; // words overlap between chunks
const DEFAULT_TOP_K = 5; // number of results to retrieve

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
}

export interface RAGAnswer {
  answer: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    snippet: string;
    score: number;
  }>;
  confidence: number;
  tokensUsed?: number;
}

export interface RAGQueryLog {
  id: string;
  userId: string;
  query: string;
  response: string;
  documentIds: string[];
  confidenceScore: number;
  createdAt: Date;
}

// ============================================================================
// PINECONE CLIENT SINGLETON
// ============================================================================

let pineconeClient: Pinecone | null = null;

/**
 * Initialize and return Pinecone client (singleton pattern)
 */
export function initPinecone(): Pinecone {
  if (!PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY environment variable is not set');
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });
    console.log('[RAG] Pinecone client initialized');
  }

  return pineconeClient;
}

/**
 * Get Pinecone index
 */
export function getPineconeIndex() {
  const client = initPinecone();
  return client.index(PINECONE_INDEX);
}

// ============================================================================
// GEMINI CLIENT
// ============================================================================

let genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is not set');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding vector for text using Gemini embedding model
 * Returns 768-dimensional vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getGenAIClient();

  try {
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ parts: [{ text }] }],
    });

    const embedding = result.embeddings?.[0]?.values;
    if (!embedding || embedding.length === 0) {
      throw new Error('No embedding returned from Gemini');
    }

    return embedding;
  } catch (error: any) {
    console.error('[RAG] Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(text => generateEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);

    // Small delay between batches to respect rate limits
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
 * Split text into overlapping chunks for better retrieval
 * Uses word-based chunking with configurable size and overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const words = normalizedText.split(' ');

  if (words.length <= chunkSize) {
    return [normalizedText];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkSize, words.length);
    const chunk = words.slice(startIndex, endIndex).join(' ');
    chunks.push(chunk);

    // Move start index forward by (chunkSize - overlap)
    startIndex += chunkSize - overlap;

    // Prevent infinite loop if overlap >= chunkSize
    if (startIndex <= chunks.length * (chunkSize - overlap) - chunkSize) {
      break;
    }
  }

  return chunks;
}

/**
 * Smart chunking that respects sentence boundaries
 */
export function chunkTextSmart(
  text: string,
  maxChunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split by sentence endings
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;

    if (currentWordCount + sentenceWords > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.join(' '));

      // Start new chunk with overlap (last few sentences)
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

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

// ============================================================================
// PINECONE OPERATIONS
// ============================================================================

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }>
): Promise<void> {
  const index = getPineconeIndex();

  // Upsert in batches of 100 (Pinecone limit)
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(`[RAG] Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
  }
}

/**
 * Search for similar vectors in Pinecone
 */
export async function searchSimilar(
  queryEmbedding: number[],
  filters?: Record<string, any>,
  topK: number = DEFAULT_TOP_K
): Promise<RAGSearchResult[]> {
  const index = getPineconeIndex();

  const queryOptions: any = {
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  };

  if (filters && Object.keys(filters).length > 0) {
    queryOptions.filter = filters;
  }

  const results = await index.query(queryOptions);

  return (results.matches || []).map(match => ({
    chunk: {
      id: match.id,
      text: (match.metadata?.text as string) || '',
      documentId: (match.metadata?.documentId as string) || '',
      chunkIndex: (match.metadata?.chunkIndex as number) || 0,
      metadata: match.metadata as Record<string, any>,
    },
    score: match.score || 0,
    documentName: (match.metadata?.documentName as string) || undefined,
  }));
}

/**
 * Delete vectors by document ID
 */
export async function deleteByDocumentId(documentId: string): Promise<void> {
  const index = getPineconeIndex();

  // Delete all vectors with matching document ID
  await index.deleteMany({
    filter: { documentId: { $eq: documentId } }
  });

  console.log(`[RAG] Deleted vectors for document: ${documentId}`);
}

/**
 * Delete vectors by user ID (for GDPR right to be forgotten)
 */
export async function deleteByUserId(userId: string): Promise<void> {
  const index = getPineconeIndex();

  await index.deleteMany({
    filter: { userId: { $eq: userId } }
  });

  console.log(`[RAG] Deleted all vectors for user: ${userId}`);
}

// ============================================================================
// ANSWER GENERATION
// ============================================================================

/**
 * Generate answer using retrieved context
 */
export async function generateAnswer(
  query: string,
  context: RAGSearchResult[],
  language: string = 'es'
): Promise<RAGAnswer> {
  const client = getGenAIClient();

  if (context.length === 0) {
    return {
      answer: language === 'es'
        ? 'No se encontraron documentos relevantes para responder a tu pregunta.'
        : 'No relevant documents found to answer your question.',
      sources: [],
      confidence: 0,
    };
  }

  // Build context string with source references
  const contextParts = context.map((result, idx) => {
    const sourceRef = `[Fuente ${idx + 1}: ${result.documentName || result.chunk.documentId}]`;
    return `${sourceRef}\n${result.chunk.text}`;
  });
  const contextString = contextParts.join('\n\n---\n\n');

  const systemPrompt = language === 'es'
    ? `Eres un asistente experto que responde preguntas basándose ÚNICAMENTE en los documentos proporcionados.

REGLAS IMPORTANTES:
1. Responde SOLO con información de los documentos proporcionados
2. Si la información no está en los documentos, di "No tengo información suficiente en los documentos para responder"
3. Cita las fuentes usando [Fuente X] cuando uses información específica
4. Sé preciso y conciso
5. Responde en español

DOCUMENTOS DE REFERENCIA:
${contextString}`
    : `You are an expert assistant that answers questions based ONLY on the provided documents.

IMPORTANT RULES:
1. Answer ONLY with information from the provided documents
2. If the information is not in the documents, say "I don't have enough information in the documents to answer"
3. Cite sources using [Source X] when using specific information
4. Be precise and concise
5. Answer in English

REFERENCE DOCUMENTS:
${contextString}`;

  try {
    const result = await client.models.generateContent({
      model: GENERATION_MODEL,
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: `Pregunta: ${query}` }] }
      ],
      config: {
        temperature: 0.3, // Lower temperature for more factual responses
        maxOutputTokens: 1024,
      }
    });

    const answer = result.text || '';

    // Calculate confidence based on top scores
    const avgScore = context.reduce((sum, r) => sum + r.score, 0) / context.length;
    const confidence = Math.round(avgScore * 100) / 100;

    return {
      answer,
      sources: context.map((result, idx) => ({
        documentId: result.chunk.documentId,
        documentName: result.documentName || result.chunk.documentId,
        chunkIndex: result.chunk.chunkIndex,
        snippet: result.chunk.text.substring(0, 200) + '...',
        score: Math.round(result.score * 100) / 100,
      })),
      confidence,
      tokensUsed: result.usageMetadata?.totalTokenCount,
    };
  } catch (error: any) {
    console.error('[RAG] Error generating answer:', error.message);
    throw error;
  }
}

// ============================================================================
// FULL RAG PIPELINE
// ============================================================================

/**
 * Complete RAG query: embed query -> search -> generate answer
 */
export async function ragQuery(
  query: string,
  userId: string,
  filters?: {
    documentIds?: string[];
    projectId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
  topK: number = DEFAULT_TOP_K
): Promise<RAGAnswer> {
  console.log(`[RAG] Processing query for user ${userId}: "${query.substring(0, 50)}..."`);

  // 1. Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // 2. Build Pinecone filters
  const pineconeFilters: Record<string, any> = {
    userId: { $eq: userId }, // IMPORTANT: Filter by user for data isolation
  };

  if (filters?.documentIds && filters.documentIds.length > 0) {
    pineconeFilters.documentId = { $in: filters.documentIds };
  }

  if (filters?.projectId) {
    pineconeFilters.projectId = { $eq: filters.projectId };
  }

  // 3. Search similar vectors
  const searchResults = await searchSimilar(queryEmbedding, pineconeFilters, topK);

  // 4. Generate answer with context
  const answer = await generateAnswer(query, searchResults);

  return answer;
}

// ============================================================================
// DOCUMENT INGESTION
// ============================================================================

/**
 * Ingest a document into the RAG system
 */
export async function ingestDocument(
  documentId: string,
  documentName: string,
  text: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<{ chunksCreated: number; vectorsUploaded: number }> {
  console.log(`[RAG] Ingesting document: ${documentId}`);

  // 1. Chunk the text
  const chunks = chunkTextSmart(text);
  console.log(`[RAG] Created ${chunks.length} chunks`);

  if (chunks.length === 0) {
    return { chunksCreated: 0, vectorsUploaded: 0 };
  }

  // 2. Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(chunks);

  // 3. Prepare vectors for Pinecone
  const vectors = chunks.map((chunkText, index) => ({
    id: `${documentId}_chunk_${index}`,
    values: embeddings[index],
    metadata: {
      documentId,
      documentName,
      userId,
      chunkIndex: index,
      text: chunkText,
      createdAt: new Date().toISOString(),
      ...metadata,
    },
  }));

  // 4. Upsert to Pinecone
  await upsertVectors(vectors);

  // 5. Store chunk references in database
  for (let i = 0; i < chunks.length; i++) {
    await sql`
      INSERT INTO rag_document_chunks (document_id, chunk_index, chunk_text, pinecone_id)
      VALUES (${documentId}::uuid, ${i}, ${chunks[i]}, ${vectors[i].id})
      ON CONFLICT (document_id, chunk_index) DO UPDATE
      SET chunk_text = EXCLUDED.chunk_text, pinecone_id = EXCLUDED.pinecone_id
    `;
  }

  console.log(`[RAG] Document ${documentId} ingested: ${chunks.length} chunks`);

  return {
    chunksCreated: chunks.length,
    vectorsUploaded: vectors.length,
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log RAG query for audit (GDPR/ENS compliance)
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
    const result = await sql`
      INSERT INTO rag_queries (
        user_id,
        query,
        response,
        document_ids,
        confidence_score,
        ip_address,
        user_agent
      )
      VALUES (
        ${userId}::uuid,
        ${query},
        ${response},
        ${documentIds.length > 0 ? `{${documentIds.join(',')}}` : null}::uuid[],
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
 * Get RAG query history for a user
 */
export async function getRagQueryHistory(
  userId: string,
  limit: number = 50
): Promise<RAGQueryLog[]> {
  const result = await sql<RAGQueryLog>`
    SELECT id, user_id, query, response, document_ids, confidence_score, created_at
    FROM rag_queries
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initPinecone,
  getPineconeIndex,
  generateEmbedding,
  generateEmbeddings,
  chunkText,
  chunkTextSmart,
  upsertVectors,
  searchSimilar,
  deleteByDocumentId,
  deleteByUserId,
  generateAnswer,
  ragQuery,
  ingestDocument,
  logRagQuery,
  getRagQueryHistory,
};
