/**
 * USAGE TRACKER SERVICE
 * api/lib/usageTracker.ts
 *
 * Servicio central para trackear consumos por empresa.
 * - trackUsage(): INSERT no-bloqueante en usage_events
 * - trackGeminiCall(): helper para respuestas de @google/genai
 * - Cache de pricing_config con TTL 5 min
 * - calculateCost(): calcula coste USD
 */

import { sql } from '@vercel/postgres';

// ============================================================================
// TYPES
// ============================================================================

export interface UsageEvent {
  userId?: string;
  userEmail?: string;
  companyName?: string;
  eventType: string;       // extraction|transcription|rag_query|rag_ingest|blob_upload|email_send
  eventSubtype?: string;
  appId?: string;
  serviceProvider: string; // gemini|gemini_embedding|vercel_blob|resend
  modelId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  unitsConsumed?: number;
  unitType?: string;       // bytes|emails|chunks
  resourceId?: string;
  resourceName?: string;
  processingTimeMs?: number;
  metadata?: Record<string, any>;
}

export interface GeminiTrackingParams {
  eventType: string;
  eventSubtype?: string;
  userId?: string;
  userEmail?: string;
  companyName?: string;
  modelId?: string;
  resourceId?: string;
  resourceName?: string;
  processingTimeMs?: number;
  metadata?: Record<string, any>;
}

interface PricingEntry {
  serviceProvider: string;
  modelId: string | null;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  costPerUnit: number;
  unitType: string | null;
}

// ============================================================================
// PRICING CACHE (TTL 5 min)
// ============================================================================

let pricingCache: PricingEntry[] = [];
let pricingCacheExpiry = 0;
const PRICING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPricing(): Promise<PricingEntry[]> {
  const now = Date.now();
  if (pricingCache.length > 0 && now < pricingCacheExpiry) {
    return pricingCache;
  }

  try {
    const result = await sql`
      SELECT service_provider, model_id,
             input_cost_per_million_tokens, output_cost_per_million_tokens,
             cost_per_unit, unit_type
      FROM pricing_config
      WHERE effective_until IS NULL OR effective_until > NOW()
      ORDER BY effective_from DESC
    `;

    pricingCache = result.rows.map(row => ({
      serviceProvider: row.service_provider,
      modelId: row.model_id,
      inputCostPerMillionTokens: parseFloat(row.input_cost_per_million_tokens) || 0,
      outputCostPerMillionTokens: parseFloat(row.output_cost_per_million_tokens) || 0,
      costPerUnit: parseFloat(row.cost_per_unit) || 0,
      unitType: row.unit_type,
    }));
    pricingCacheExpiry = now + PRICING_CACHE_TTL;
  } catch (error) {
    console.warn('[UsageTracker] Error loading pricing config, using cached:', error);
    // If cache is stale but exists, use it. Otherwise return empty.
  }

  return pricingCache;
}

// ============================================================================
// COST CALCULATION
// ============================================================================

function calculateCost(event: UsageEvent, pricing: PricingEntry[]): number {
  // Find matching pricing entry (prefer exact model match, fallback to provider-only)
  let entry = pricing.find(
    p => p.serviceProvider === event.serviceProvider && p.modelId === event.modelId
  );
  if (!entry) {
    entry = pricing.find(
      p => p.serviceProvider === event.serviceProvider && !p.modelId
    );
  }
  if (!entry) return 0;

  // Token-based cost (LLM calls)
  if ((event.promptTokens || 0) > 0 || (event.completionTokens || 0) > 0) {
    const inputCost = ((event.promptTokens || 0) / 1_000_000) * entry.inputCostPerMillionTokens;
    const outputCost = ((event.completionTokens || 0) / 1_000_000) * entry.outputCostPerMillionTokens;
    return inputCost + outputCost;
  }

  // Unit-based cost (blob, email, etc.)
  if ((event.unitsConsumed || 0) > 0 && entry.costPerUnit > 0) {
    return (event.unitsConsumed || 0) * entry.costPerUnit;
  }

  return 0;
}

// ============================================================================
// EXTRACT GEMINI USAGE METADATA
// ============================================================================

export function extractGeminiUsage(response: any): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const usage = response?.usageMetadata;
  if (!usage) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  return {
    promptTokens: usage.promptTokenCount || 0,
    completionTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0,
  };
}

// ============================================================================
// MAIN TRACKING FUNCTIONS
// ============================================================================

/**
 * INSERT no-bloqueante en usage_events con coste pre-calculado.
 * Nunca lanza excepciones — los errores se loguean silenciosamente.
 */
export async function trackUsage(event: UsageEvent): Promise<void> {
  // Fire-and-forget: no await en el caller si se desea non-blocking
  try {
    const pricing = await getPricing();
    const costUsd = calculateCost(event, pricing);

    await sql`
      INSERT INTO usage_events (
        user_id, user_email, company_name,
        event_type, event_subtype, app_id,
        service_provider, model_id,
        prompt_tokens, completion_tokens, total_tokens,
        units_consumed, unit_type,
        cost_usd, resource_id, resource_name,
        processing_time_ms, metadata
      ) VALUES (
        ${event.userId || null}::uuid,
        ${event.userEmail || null},
        ${event.companyName || null},
        ${event.eventType},
        ${event.eventSubtype || null},
        ${event.appId || 'verbadocpro'},
        ${event.serviceProvider},
        ${event.modelId || null},
        ${event.promptTokens || 0},
        ${event.completionTokens || 0},
        ${event.totalTokens || 0},
        ${event.unitsConsumed || 0},
        ${event.unitType || null},
        ${costUsd},
        ${event.resourceId || null},
        ${event.resourceName || null},
        ${event.processingTimeMs || null},
        ${JSON.stringify(event.metadata || {})}::jsonb
      )
    `;
  } catch (error) {
    // Non-blocking: solo log, nunca rompe el flujo principal
    console.error('[UsageTracker] Error tracking usage:', error);
  }
}

/**
 * Helper para trackear llamadas a Gemini.
 * Extrae usageMetadata del response de @google/genai y llama trackUsage.
 */
export async function trackGeminiCall(
  response: any,
  params: GeminiTrackingParams
): Promise<void> {
  const { promptTokens, completionTokens, totalTokens } = extractGeminiUsage(response);

  trackUsage({
    userId: params.userId,
    userEmail: params.userEmail,
    companyName: params.companyName,
    eventType: params.eventType,
    eventSubtype: params.eventSubtype,
    serviceProvider: 'gemini',
    modelId: params.modelId,
    promptTokens,
    completionTokens,
    totalTokens,
    resourceId: params.resourceId,
    resourceName: params.resourceName,
    processingTimeMs: params.processingTimeMs,
    metadata: params.metadata,
  }).catch(() => {}); // Ensure truly non-blocking
}

/**
 * Helper para trackear llamadas a embeddings.
 */
export async function trackEmbeddingCall(params: {
  userId?: string;
  userEmail?: string;
  companyName?: string;
  chunksCount: number;
  resourceId?: string;
  resourceName?: string;
}): Promise<void> {
  trackUsage({
    userId: params.userId,
    userEmail: params.userEmail,
    companyName: params.companyName,
    eventType: 'rag_ingest',
    serviceProvider: 'gemini_embedding',
    modelId: 'gemini-embedding-001',
    unitsConsumed: params.chunksCount,
    unitType: 'chunks',
    resourceId: params.resourceId,
    resourceName: params.resourceName,
  }).catch(() => {});
}

/**
 * Helper para trackear subidas a Blob Storage.
 */
export async function trackBlobUpload(params: {
  userId?: string;
  userEmail?: string;
  companyName?: string;
  sizeBytes: number;
  resourceId?: string;
  resourceName?: string;
}): Promise<void> {
  trackUsage({
    userId: params.userId,
    userEmail: params.userEmail,
    companyName: params.companyName,
    eventType: 'blob_upload',
    serviceProvider: 'vercel_blob',
    modelId: 'storage',
    unitsConsumed: params.sizeBytes,
    unitType: 'bytes',
    resourceId: params.resourceId,
    resourceName: params.resourceName,
  }).catch(() => {});
}

/**
 * Helper para trackear envios de email.
 */
export async function trackEmailSend(params: {
  userId?: string;
  userEmail?: string;
  companyName?: string;
  resourceId?: string;
  resourceName?: string;
  emailType?: string;
}): Promise<void> {
  trackUsage({
    userId: params.userId,
    userEmail: params.userEmail,
    companyName: params.companyName,
    eventType: 'email_send',
    eventSubtype: params.emailType,
    serviceProvider: 'resend',
    modelId: 'email',
    unitsConsumed: 1,
    unitType: 'emails',
    resourceId: params.resourceId,
    resourceName: params.resourceName,
  }).catch(() => {});
}

/**
 * Resolve user context from DB for tracking (gets email, company_name).
 * Used when only userId is available.
 */
export async function resolveUserContext(userId: string): Promise<{
  userEmail: string | null;
  companyName: string | null;
}> {
  try {
    const result = await sql`
      SELECT email, company_name FROM users WHERE id = ${userId}::uuid LIMIT 1
    `;
    if (result.rows.length > 0) {
      return {
        userEmail: result.rows[0].email || null,
        companyName: result.rows[0].company_name || null,
      };
    }
  } catch (error) {
    console.warn('[UsageTracker] Error resolving user context:', error);
  }
  return { userEmail: null, companyName: null };
}
