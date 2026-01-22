
import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fixDatabase() {
  try {
    console.log('🛠️ Corrigiendo base de datos (Migración 004)...');
    
    // 1. Añadir columnas de PDF
    await sql`
      ALTER TABLE extraction_results
      ADD COLUMN IF NOT EXISTS pdf_blob_url TEXT,
      ADD COLUMN IF NOT EXISTS pdf_blob_pathname TEXT,
      ADD COLUMN IF NOT EXISTS pdf_stored_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS pdf_size_bytes BIGINT,
      ADD COLUMN IF NOT EXISTS pdf_checksum VARCHAR(64);
    `;
    console.log('✅ Columnas de PDF añadidas.');

    // 2. Añadir columna de rejection_reason si no existe
    await sql`
      ALTER TABLE extraction_results
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `;
    console.log('✅ Columna rejection_reason verificada.');

    console.log('🚀 Base de datos sincronizada con el código.');
  } catch (error) {
    console.error('❌ Error al corregir BD:', error);
  }
}
fixDatabase();
