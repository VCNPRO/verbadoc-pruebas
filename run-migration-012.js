/**
 * Migración 012: Crear tabla app_settings para contador Total fijo
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración 012: Crear tabla app_settings\n');

    // 1. Crear tabla app_settings
    console.log('1. Creando tabla app_settings...');
    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_by VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('   ✅ Tabla creada\n');

    // 2. Insertar valor inicial del contador (0)
    console.log('2. Insertando contador total inicial...');
    await sql`
      INSERT INTO app_settings (key, value, updated_by)
      VALUES ('total_counter', '0', 'system')
      ON CONFLICT (key) DO NOTHING
    `;
    console.log('   ✅ Contador inicializado en 0\n');

    // 3. Verificar
    console.log('3. Verificando...');
    const check = await sql`
      SELECT * FROM app_settings WHERE key = 'total_counter'
    `;
    console.log('   Valor actual:', check.rows[0]);

    console.log('\n==========================================');
    console.log('✅ MIGRACIÓN 012 COMPLETADA');
    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
