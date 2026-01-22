// Script de Verificación de Cabeceras de Seguridad (Evidencia ENS)
// Uso: node scripts/security-check.js

const https = require('https');

const TARGET_DOMAIN = 'https://www.verbadocpro.eu';

console.log(`
🔍 Iniciando auditoría de seguridad sobre: ${TARGET_DOMAIN}`);
console.log('---------------------------------------------------------');

const options = {
  method: 'HEAD', // Solo pedimos cabeceras, no el cuerpo
};

const req = https.request(TARGET_DOMAIN, options, (res) => {
  console.log(`Estado de respuesta: ${res.statusCode} ${res.statusMessage}
`);

  // 1. Verificar HSTS (Strict-Transport-Security)
  const hsts = res.headers['strict-transport-security'];
  if (hsts && hsts.includes('max-age')) {
    console.log('✅ [CONTROL ENS-01] Strict-Transport-Security ... PASSED');
    console.log(`   Valor: ${hsts}`);
  } else {
    console.log('❌ [CONTROL ENS-01] Strict-Transport-Security ... FAILED');
  }

  // 2. Verificar X-Content-Type-Options
  const xContentType = res.headers['x-content-type-options'];
  if (xContentType === 'nosniff') {
    console.log('✅ [CONTROL ENS-02] X-Content-Type-Options .... PASSED');
    console.log(`   Valor: ${xContentType}`);
  } else {
    console.log('❌ [CONTROL ENS-02] X-Content-Type-Options .... FAILED');
  }

  // Verificación extra: CSP
  const csp = res.headers['content-security-policy'];
  if (csp) {
    console.log('✅ [CONTROL ENS-03] Content-Security-Policy ..... PASSED');
    console.log('   (Política activa y detectada)');
  } else {
    console.log('⚠️ [CONTROL ENS-03] Content-Security-Policy ..... NOT DETECTED');
  }

  console.log('---------------------------------------------------------');
  if (hsts && xContentType === 'nosniff') {
    console.log('🛡️  RESULTADO FINAL: EL SITIO CUMPLE CON LOS REQUISITOS DE CABECERAS.');
    process.exit(0);
  } else {
    console.error('⚠️  RESULTADO FINAL: SE DETECTARON FALLOS EN LA SEGURIDAD.');
    process.exit(1);
  }
});

req.on('error', (e) => {
  console.error(`❌ Error fatal al conectar con el dominio: ${e.message}`);
  process.exit(1);
});

req.end();
