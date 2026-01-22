#!/usr/bin/env node
// 🔍 Script de Verificación de Credenciales de Google Cloud
// Ejecuta: node verificar-credenciales.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de Google Cloud...\n');

// Leer .env.local
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: No existe el archivo .env.local');
  console.log('✅ Solución: El archivo ya debería estar creado en la raíz del proyecto');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

// Parsear variables de entorno
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#][^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    envVars[key] = value;
  }
});

let errores = 0;
let advertencias = 0;

// 1. Verificar PROJECT_ID
console.log('📍 [1/3] Verificando PROJECT_ID...');
const projectId = envVars['VITE_GEMINI_PROJECT_ID'] || envVars['GOOGLE_CLOUD_PROJECT'];

if (!projectId || projectId === 'TU_PROJECT_ID_AQUI') {
  console.error('   ❌ PROJECT_ID no configurado');
  console.log('   👉 Debes reemplazar "TU_PROJECT_ID_AQUI" con tu Project ID real');
  errores++;
} else {
  console.log(`   ✅ PROJECT_ID configurado: ${projectId}`);
}

// 2. Verificar GOOGLE_APPLICATION_CREDENTIALS
console.log('\n🔑 [2/3] Verificando GOOGLE_APPLICATION_CREDENTIALS...');
const credPath = envVars['GOOGLE_APPLICATION_CREDENTIALS'];

if (!credPath) {
  console.error('   ❌ GOOGLE_APPLICATION_CREDENTIALS no configurado');
  errores++;
} else if (credPath.startsWith('{')) {
  // JSON inline
  try {
    const creds = JSON.parse(credPath);
    if (creds.type === 'service_account' && creds.project_id && creds.private_key) {
      console.log('   ✅ Credenciales JSON válidas (formato inline)');
      console.log(`   📦 Service Account: ${creds.client_email}`);
      console.log(`   📦 Project: ${creds.project_id}`);
    } else {
      console.error('   ❌ JSON incompleto (faltan campos obligatorios)');
      errores++;
    }
  } catch (e) {
    console.error('   ❌ JSON inválido:', e.message);
    errores++;
  }
} else {
  // Archivo de credenciales
  const fullPath = path.resolve(__dirname, credPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`   ❌ Archivo no encontrado: ${fullPath}`);
    console.log('   👉 Debes descargar el archivo JSON de Google Cloud y colocarlo en la ruta indicada');
    errores++;
  } else {
    try {
      const creds = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      if (creds.type === 'service_account' && creds.project_id && creds.private_key) {
        console.log(`   ✅ Archivo de credenciales válido: ${credPath}`);
        console.log(`   📦 Service Account: ${creds.client_email}`);
        console.log(`   📦 Project: ${creds.project_id}`);

        // Verificar que coincida el project_id
        if (creds.project_id !== projectId) {
          console.warn(`   ⚠️  ADVERTENCIA: El project_id del JSON (${creds.project_id}) no coincide con VITE_GEMINI_PROJECT_ID (${projectId})`);
          advertencias++;
        }
      } else {
        console.error('   ❌ Archivo JSON incompleto (faltan campos obligatorios)');
        errores++;
      }
    } catch (e) {
      console.error('   ❌ Error al leer archivo JSON:', e.message);
      errores++;
    }
  }
}

// 3. Verificar región
console.log('\n🌍 [3/3] Verificando región...');
const location = envVars['VITE_GEMINI_LOCATION'];
if (location === 'europe-west1') {
  console.log(`   ✅ Región correcta: ${location} (Bélgica - GDPR compliant)`);
} else if (!location) {
  console.log('   ⚠️  Región no especificada, usando default: europe-west1');
  advertencias++;
} else {
  console.warn(`   ⚠️  Región no europea: ${location} (puede no cumplir GDPR)`);
  advertencias++;
}

// Resumen final
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE VERIFICACIÓN\n');

if (errores === 0 && advertencias === 0) {
  console.log('✅ ¡TODO PERFECTO! Tu configuración está lista.');
  console.log('🚀 Puedes iniciar la aplicación con: npm run dev');
  process.exit(0);
} else if (errores === 0) {
  console.log(`⚠️  Configuración válida con ${advertencias} advertencia(s)`);
  console.log('✅ Puedes iniciar la aplicación, pero revisa las advertencias');
  process.exit(0);
} else {
  console.log(`❌ Encontrados ${errores} error(es) y ${advertencias} advertencia(s)`);
  console.log('🔧 Sigue la guía en GUIA_CONFIGURACION_GOOGLE_CLOUD.md');
  process.exit(1);
}
