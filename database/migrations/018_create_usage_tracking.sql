-- ============================================================================
-- Migration 018: Usage Tracking (usage_events + pricing_config)
-- Sistema de tracking de consumos por empresa para VerbadocPro
-- Event-sourcing: 1 fila por accion facturable
-- ============================================================================

-- Tabla de eventos de uso (event-sourcing)
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  company_name VARCHAR(255),

  -- Clasificacion del evento
  event_type VARCHAR(50) NOT NULL,  -- extraction|transcription|rag_query|rag_ingest|blob_upload|email_send
  event_subtype VARCHAR(100),        -- sub-clasificacion opcional
  app_id VARCHAR(50) DEFAULT 'verbadocpro',

  -- Servicio/Modelo
  service_provider VARCHAR(50) NOT NULL,  -- gemini|gemini_embedding|vercel_blob|resend
  model_id VARCHAR(100),

  -- Tokens (para LLM calls)
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Unidades (para servicios no-token)
  units_consumed NUMERIC DEFAULT 0,
  unit_type VARCHAR(50),  -- bytes|emails|chunks

  -- Coste calculado al insertar
  cost_usd NUMERIC(12, 8) DEFAULT 0,

  -- Referencia al recurso
  resource_id VARCHAR(255),
  resource_name VARCHAR(500),

  -- Metricas
  processing_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para queries frecuentes del dashboard
CREATE INDEX IF NOT EXISTS idx_usage_events_company_date
  ON usage_events (company_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_date
  ON usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_type
  ON usage_events (event_type);

CREATE INDEX IF NOT EXISTS idx_usage_events_created
  ON usage_events (created_at DESC);

-- Tabla de configuracion de precios (editable sin deploy)
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_provider VARCHAR(50) NOT NULL,
  model_id VARCHAR(100),

  -- Costes por token (para LLM)
  input_cost_per_million_tokens NUMERIC(12, 6) DEFAULT 0,
  output_cost_per_million_tokens NUMERIC(12, 6) DEFAULT 0,

  -- Costes por unidad (para servicios no-token)
  cost_per_unit NUMERIC(12, 8) DEFAULT 0,
  unit_type VARCHAR(50),

  -- Vigencia
  effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  effective_until TIMESTAMP WITH TIME ZONE,  -- NULL = activo

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_config_provider_model
  ON pricing_config (service_provider, model_id);

-- ============================================================================
-- Seed: Precios actuales de Google Gemini (enero 2025)
-- ============================================================================

-- Gemini 2.0 Flash
INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes)
VALUES ('gemini', 'gemini-2.0-flash', 0.10, 0.40, 'Gemini 2.0 Flash - precio general')
ON CONFLICT DO NOTHING;

-- Gemini 2.5 Flash
INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes)
VALUES ('gemini', 'gemini-2.5-flash', 0.15, 0.60, 'Gemini 2.5 Flash - precio general')
ON CONFLICT DO NOTHING;

-- Gemini 2.5 Flash Preview
INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes)
VALUES ('gemini', 'gemini-2.5-flash-preview', 0.15, 0.60, 'Gemini 2.5 Flash Preview')
ON CONFLICT DO NOTHING;

-- Gemini 3 Flash Preview
INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes)
VALUES ('gemini', 'gemini-3-flash-preview', 0.15, 0.60, 'Gemini 3 Flash Preview - precio estimado')
ON CONFLICT DO NOTHING;

-- Gemini 1.5 Pro
INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes)
VALUES ('gemini', 'gemini-1.5-pro', 1.25, 5.00, 'Gemini 1.5 Pro')
ON CONFLICT DO NOTHING;

-- Gemini Embedding
INSERT INTO pricing_config (service_provider, model_id, input_cost_per_million_tokens, output_cost_per_million_tokens, notes)
VALUES ('gemini_embedding', 'gemini-embedding-001', 0.004, 0.0, 'Gemini Embedding - solo input tokens')
ON CONFLICT DO NOTHING;

-- Vercel Blob Storage (precio por GB/mes, aqui por byte)
INSERT INTO pricing_config (service_provider, model_id, cost_per_unit, unit_type, notes)
VALUES ('vercel_blob', 'storage', 0.00000000023, 'bytes', 'Vercel Blob - ~$0.23/GB/mes')
ON CONFLICT DO NOTHING;

-- Resend email
INSERT INTO pricing_config (service_provider, model_id, cost_per_unit, unit_type, notes)
VALUES ('resend', 'email', 0.001, 'emails', 'Resend - ~$1/1000 emails')
ON CONFLICT DO NOTHING;
