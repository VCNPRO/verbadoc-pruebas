# VerbadocPro Europa - Analisis Integral para Clientes Institucionales

> **Fecha:** 2026-02-10
> **Version:** v2.0.0 (verbadoc-enterprise)
> **Plataforma:** Vercel (Serverless + PostgreSQL + Blob Storage)
> **Objetivo:** 195.000 paginas / 48.000 documentos

---

## 1. RESUMEN EJECUTIVO

VerbadocPro es una plataforma de extraccion inteligente de datos documentales con IA (Gemini), busqueda semantica RAG con pgvector, y sistema de revision/validacion. Soporta 9 idiomas europeos y cumple RGPD/ENS.

**Fortalezas principales:**
- Pipeline de IA hibrido (PDF render 300 DPI + Gemini) con alta precision
- RAG completo con pgvector, chunking inteligente, y busqueda por carpetas
- Audit logging exhaustivo para RGPD/ENS
- Backups cifrados AES-256-GCM con retencion (7 diarios, 4 semanales, 3 mensuales)
- 9 idiomas: ES, CA, GL, EU, PT, FR, EN, IT, DE

**Areas criticas a resolver para clientes institucionales:**
- CORS wildcard en 16+ endpoints
- Rate limiting no aplicado (codigo existe pero no se usa)
- Blob storage con acceso publico
- JWT con expiracion de 7 dias (demasiado para banca/seguros)
- Codigo BYPASS_AUTH en produccion

---

## 2. SEGURIDAD

### 2.1 Autenticacion - BUENA con mejoras necesarias

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Hashing contraseñas | FUERTE | bcryptjs 12 salt rounds |
| JWT cookies | BUENO | httpOnly, secure, sameSite=lax |
| Expiracion JWT | MEJORABLE | 7 dias -> reducir a 1h + refresh token |
| Revocacion tokens | AUSENTE | No hay blacklist ni versionado |
| Password reset | BUENO | Token con 1h expiracion, no revela emails |
| BYPASS_AUTH flag | CRITICO | Variable en AuthContext.tsx (false pero existe) |

### 2.2 API Security

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| SQL Injection | PROTEGIDO | Queries parametrizadas en todo el codigo |
| CORS | CRITICO | 16+ endpoints con `Access-Control-Allow-Origin: *` |
| Rate Limiting | NO APLICADO | Existe en `api/lib/rateLimit.ts` pero ningun endpoint lo usa |
| Input Validation | PARCIAL | Login/register validan, otros endpoints no |
| Debug endpoints | RIESGO | `debug-env.ts`, `debug-ocr.js` con CORS wildcard |
| Auth en extract.ts | AUSENTE | Endpoint principal sin autenticacion |

### 2.3 Datos y Almacenamiento

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Cifrado en transito | FUERTE | TLS, HSTS 2 años, upgrade-insecure-requests |
| Cifrado backups | FUERTE | AES-256-GCM con scryptSync |
| Blob Storage | CRITICO | `access: 'public'` - documentos accesibles por URL directa |
| RLS PostgreSQL | DESACTIVADO | Se maneja en codigo (defense-in-depth degradada) |
| UUID como PKs | BUENO | Dificiles de adivinar |
| Audit logging | EXCELENTE | IP, user agent, accion, recurso, 2 años retencion |

### 2.4 Headers de Seguridad

| Header | Estado |
|--------|--------|
| Strict-Transport-Security | 2 años + preload |
| X-Frame-Options | SAMEORIGIN |
| X-Content-Type-Options | nosniff |
| Content-Security-Policy | Presente (pero unsafe-inline/eval) |
| Cross-Origin-Opener-Policy | same-origin |
| Permissions-Policy | Configurado |

### 2.5 RGPD/ENS Compliance

| Requisito | Estado | Implementacion |
|-----------|--------|---------------|
| Derecho al olvido (Art. 17) | IMPLEMENTADO | `/api/rag/delete` con metadata GDPR |
| Audit trail | IMPLEMENTADO | Tabla access_logs con trigger DB |
| Retencion datos | IMPLEMENTADO | 2 años logs, cleanup automatico |
| Residencia datos EU | PARCIAL | Vercel EU, pero Gemini API puede rutear fuera EU |
| Cifrado | PARCIAL | Backups si, blobs no |
| Control acceso | IMPLEMENTADO | RBAC con 3 roles (admin, user, reviewer) |

---

## 3. ARQUITECTURA Y RENDIMIENTO

### 3.1 Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 |
| Backend | Vercel Serverless Functions (Node.js) |
| Base de datos | Neon PostgreSQL + pgvector |
| Almacenamiento | Vercel Blob Storage |
| Cola | Vercel KV (Redis/Upstash) |
| IA Extraccion | Gemini 3 Flash Preview (Vertex AI europe-west1) |
| IA Embeddings | gemini-embedding-001 (768 dimensiones) |
| IA Generacion | gemini-2.0-flash |
| Email | Resend |

### 3.2 Capacidades del Sistema

| Funcionalidad | Capacidad |
|--------------|-----------|
| Extraccion IA | PDFs, imagenes, documentos escaneados (300 DPI) |
| RAG | Busqueda semantica en lenguaje natural, 9 idiomas |
| Batch processing | Hasta 50 documentos simultaneos |
| Export | Excel (.xlsx), CSV, PDF, JSON |
| Tipos documento | 15+ tipos (facturas, contratos, DNI, pasaportes, etc.) |
| Validacion | Cruzada contra Excel referencia, CIF/NIF, formatos |
| Plantillas | Personalizables por tipo de documento |
| Transcripcion | Audio a texto (integracion AssemblyAI) |

### 3.3 Idiomas Soportados

1. Español (es-ES) - por defecto
2. Catala (ca-ES)
3. Galego (gl-ES)
4. Euskara (eu-ES)
5. Portugues (pt-PT)
6. Francais (fr-FR)
7. English (en-GB)
8. Italiano (it-IT)
9. Deutsch (de-DE)

**Nota:** El i18n cubre RAG, chatbot Laia y mensajes del sistema. La UI principal esta en español.

---

## 4. CAPACIDAD PARA 195.000 PAGINAS

### 4.1 Estimacion de Tiempos

| Operacion | Por documento | Para 48K docs | Para 195K paginas |
|-----------|--------------|---------------|-------------------|
| Upload a Blob | 2-5s | 27-67 hrs | - |
| Gemini transcripcion | 5-15s/pagina | - | 271-813 hrs |
| INSERT BD | ~0.1s (bulk) | 1.3 hrs | - |
| Chunking | ~0.1s | 1.3 hrs | - |
| Embedding generation | ~1s/chunk | - | 43-108 hrs |
| Embedding INSERT | ~0.05s/batch | - | 2-5 hrs |

### 4.2 Los 7 Cuellos de Botella

| # | Bottleneck | Severidad | Solucion propuesta |
|---|-----------|-----------|-------------------|
| 1 | Timeout serverless 300s | ALTA | Workers dedicados (Cloud Run/ECS) |
| 2 | Sin cron para process-queue | CRITICA | Añadir cron o worker automatico |
| 3 | Rate limits Gemini API | MEDIA | Ya mitigado con retry adaptativo |
| 4 | Connection pool BD | MEDIA | PgBouncer o pooler de Neon |
| 5 | PDFs base64 en Redis queue | CRITICA | Subir a Blob primero, encolar solo URL |
| 6 | Body size limits (15-25MB) | MEDIA | Stream upload, chunked transfer |
| 7 | Rate limiting in-memory | BAJA | Migrar a Vercel KV |

### 4.3 Estimacion Realista

| Escenario | Tiempo estimado |
|-----------|----------------|
| Sin optimizaciones | ~67-180 dias |
| Con optimizaciones RAG actuales | ~10-15 dias (procesamiento continuo) |
| Con workers dedicados + parallelismo | ~3-5 dias |
| Gemini API como limite teorico | ~20 horas (1000 RPM extraction + 1500 RPM embeddings) |

### 4.4 Mejoras RAG Recien Implementadas

| Mejora | Antes | Despues | Ganancia |
|--------|-------|---------|----------|
| INSERT embeddings | 100 queries/doc | 4 queries/doc | 10x |
| INSERT chunks | 100 queries/doc | 2 queries/doc | 15x |
| Embedding batch | 10 paralelos | 30 paralelos | 3x |
| Rate limit recovery | Fallo total | Auto-retry | Fiabilidad |
| Timeout ingestion | 120s | 300s | Sin timeouts |

---

## 5. FIABILIDAD

### 5.1 Mecanismos de Resiliencia

| Mecanismo | Estado | Detalle |
|-----------|--------|---------|
| Retry con backoff | IMPLEMENTADO | 3 reintentos en embeddings, backoff exponencial |
| Rate limit recovery | IMPLEMENTADO | Deteccion 429, wait adaptativo, retry batch |
| Backups automaticos | IMPLEMENTADO | Diario BD, horario Excel, cifrado AES-256 |
| Retencion backups | IMPLEMENTADO | 7 diarios + 4 semanales + 3 mensuales |
| Health check | IMPLEMENTADO | Cron keep-alive diario |
| Audit trail | IMPLEMENTADO | Toda accion registrada con IP y timestamp |
| GDPR deletion | IMPLEMENTADO | Borrado completo por documento o usuario |

### 5.2 Puntos de Fallo

| Punto | Riesgo | Mitigacion |
|-------|--------|-----------|
| Gemini API caida | MEDIO | Retry con backoff, pero no hay fallback a otro proveedor |
| Neon PostgreSQL | BAJO | Managed service con replicacion, backups propios |
| Vercel Blob | BAJO | CDN distribuido, alta disponibilidad |
| Vercel KV (Redis) | MEDIO | Single region, posible perdida de cola |
| Cold starts | BAJO | Keep-alive cron diario |

---

## 6. RECOMENDACIONES PARA CLIENTES INSTITUCIONALES

### Prioridad P0 (Critico - resolver antes de ir a produccion)

1. **Eliminar CORS wildcard** de los 16+ endpoints y usar allowlist
2. **Activar rate limiting** en login, register, reset-password, extract, RAG
3. **Cambiar Blob storage a `access: 'private'`** y servir via endpoints autenticados
4. **Eliminar BYPASS_AUTH** y mock user de AuthContext.tsx
5. **Añadir auth a `extract.ts`** (actualmente sin autenticacion)
6. **Eliminar/proteger endpoints debug** (debug-env.ts, debug-ocr.js, verify-config.ts)
7. **Rotar credenciales Google Cloud** si `google-credentials.json` estuvo en git

### Prioridad P1 (Alto - resolver en sprint siguiente)

8. Reducir JWT expiry a 1h con refresh token rotation
9. Re-habilitar RLS en extraction_results
10. Aplicar RBAC de `role_permissions` consistentemente en todos los endpoints
11. Añadir cron para process-queue (drenaje automatico de cola)
12. Migrar rate limiter a Vercel KV para consistencia cross-instance

### Prioridad P2 (Medio - mejora continua)

13. Eliminar `unsafe-inline` y `unsafe-eval` del CSP
14. Añadir validacion estructurada con zod en endpoints
15. Implementar scan de malware en uploads
16. Traducir UI completa a los 9 idiomas (actualmente solo RAG/Laia)
17. Migrar de base64 en Redis queue a URL de Blob
18. Considerar workers dedicados para procesamiento de 195K paginas

---

## 7. CERTIFICACIONES Y COMPLIANCE

### Actualmente Cumple

- RGPD/GDPR (derecho al olvido, audit trail, retencion)
- Headers de seguridad OWASP recomendados
- Cifrado en transito (TLS 1.3, HSTS)
- Cifrado backups (AES-256-GCM)
- Procesamiento en EU (Vertex AI europe-west1)

### Pendiente para ENS/ISO 27001

- Cifrado at rest de documentos en Blob
- Rate limiting efectivo
- Eliminacion de endpoints debug
- Autenticacion completa en todos los endpoints
- RLS activo en base de datos
- Token rotation y revocacion
- Scan de malware en uploads

---

## 8. INVENTARIO DE ENDPOINTS (80+)

### Autenticacion (7)
- POST /api/auth/login, /register, /logout, /forgot-password, /reset-password
- GET /api/auth/me, /verify

### Extraccion Core (7)
- POST /api/extract, /extract-ai, /extract-hybrid, /extract-field
- POST /api/analyze-pdf-type, /analyze-structure
- GET /api/field-stats

### Queue & Batch (4)
- POST /api/queue-document, /process-queue
- POST /api/batch/create
- GET /api/batch/[id]/status

### Extractions CRUD (10)
- GET/POST /api/extractions
- GET /api/extractions/[id]
- POST .../approve, /reject, /validate, /cross-validate, /field-edit, /upload-pdf
- DELETE .../delete

### RAG System (8)
- POST /api/rag/upload-blob, /upload-and-ingest, /ingest, /batch-ingest, /ask
- DELETE /api/rag/delete
- GET/POST /api/rag/folders
- POST /api/rag/update-description

### Master Excel (4)
- GET/POST /api/master-excel
- GET /api/master-excel/[id], /download
- POST /api/master-excel/send-to-review

### Admin (10+)
- GET /api/admin/stats, /users, /logs
- POST /api/admin/set-admin, /backup-manual, /cleanup-corrupt
- GET/PATCH/POST /api/admin/user-quotas
- POST /api/admin/run-migration-*

### Otros (10+)
- POST /api/reference-data/upload
- POST /api/export/consolidated
- POST /api/transcribe
- POST /api/notifications/send
- GET/POST /api/column-mappings
- GET/POST /api/modules
- GET /api/documents/serve

### Cron Jobs (3)
- /api/cron/keep-alive (diario)
- /api/cron/backup-master-excel (horario)
- /api/cron/backup-database (diario 2AM)
