-- Migration 015: Crear tabla field_correction_stats
-- Tracking de correcciones humanas por campo
-- Tabla ADITIVA - no modifica nada existente
-- Rollback: DROP TABLE IF EXISTS field_correction_stats;

CREATE TABLE IF NOT EXISTS field_correction_stats (
  id SERIAL PRIMARY KEY,
  field_name VARCHAR(100) NOT NULL UNIQUE,
  total_extractions INTEGER DEFAULT 0,
  human_corrections INTEGER DEFAULT 0,
  last_correction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_stats_error_rate
  ON field_correction_stats(field_name);
