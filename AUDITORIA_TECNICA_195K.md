# AUDITORÍA TÉCNICA - Viabilidad para 195,000 páginas
## VerbadocPro Europa - Documento Interno CONFIDENCIAL
**Fecha:** 9 de febrero de 2026

---

## RESPUESTA RÁPIDA

**¿La arquitectura actual es suficiente para 195,000 páginas?**

**NO en su estado actual.** La app funciona bien para decenas o cientos de documentos, pero tiene **7 cuellos de botella críticos** que la harían fallar o tardar semanas en procesar 195,000 páginas. Con las mejoras detalladas abajo (estimamos 3-5 días de desarrollo), sí será viable.

---

## 1. ARQUITECTURA ACTUAL - RADIOGRAFÍA

### Stack tecnológico
| Componente | Tecnología | Límite actual |
|---|---|---|
| Frontend | React + Vite | Navegador del usuario |
| Backend | Vercel Serverless Functions | 300s timeout máximo |
| Base de datos | Neon PostgreSQL + pgvector | Pool: ~100 conexiones |
| Almacenamiento | Vercel Blob Storage | 100MB por archivo |
| Cola de trabajos | Vercel KV (Redis) | Memoria limitada |
| IA Transcripción | Gemini 2.0 Flash | 1,000 RPM (peticiones/min) |
| IA Embeddings | gemini-embedding-001 (768 dims) | 1,500 RPM |
| Backups | Vercel Blob (gzip) | Diario 2 AM |

### Pipeline actual (por documento)
```
Usuario → Navegador → upload-and-ingest.ts (120s timeout)
                          ├── 1. Subir a Vercel Blob (~2-5s)
                          ├── 2. Transcribir con Gemini (~5-15s por página)
                          ├── 3. Guardar en PostgreSQL (~1s)
                          ├── 4. Chunking del texto (~0.1s)
                          ├── 5. Generar embeddings (~2-5s por chunk)
                          └── 6. Insertar embeddings en pgvector (~1-3s por chunk)
```

**Tiempo por documento (4 páginas avg): ~30-60 segundos**

---

## 2. LOS 7 CUELLOS DE BOTELLA CRÍTICOS

### CRÍTICO 1: Timeout de funciones Vercel (300s máximo)
**Archivo:** `vercel.json` líneas 74-93
**Problema:** Las funciones serverless de Vercel tienen un máximo de 300 segundos (5 minutos). El endpoint `upload-and-ingest.ts` tiene solo 120 segundos.
- Un documento de 4 páginas con caligrafía compleja puede tardar 30-60s en transcribir
- Si Gemini va lento (picos de carga), un solo documento puede exceder el timeout
- **Para 195K páginas: imposible procesar lotes grandes en una sola invocación**

**Riesgo:** ⛔ ALTO - Documentos a medio procesar, datos corruptos

---

### CRÍTICO 2: Embeddings insertados UNO A UNO
**Archivo:** `api/lib/ragService.ts` líneas 241-262
```typescript
// PROBLEMA: un INSERT por cada embedding
for (const item of embeddings) {
    await sql`INSERT INTO rag_embeddings (...) VALUES (...)`;
}
```
**Problema:** Cada documento genera ~5-20 chunks → 5-20 INSERTs individuales.
- 195,000 páginas × ~8 chunks/página = **~1,560,000 INSERTs individuales**
- A ~50ms por INSERT = **21.7 horas solo en inserciones a BD**
- Agota el pool de conexiones de Neon

**Riesgo:** ⛔ ALTO - Cuello de botella más grave en rendimiento

---

### CRÍTICO 3: Sin procesamiento en segundo plano real
**Archivos:** `api/process-queue.ts`, `api/queue-document.ts`
**Problema:** Vercel no tiene workers persistentes.
- La cola usa Vercel KV pero solo se procesa cuando alguien llama a `process-queue.ts`
- Cada invocación procesa máximo 20 docs con 5 concurrentes
- No hay cron configurado para process-queue (solo backup-database y keep-alive)
- **El usuario tiene que esperar en el navegador mientras se procesan los docs**

**Riesgo:** ⛔ ALTO - No se pueden procesar 48,000 documentos desde un navegador

---

### CRÍTICO 4: Rate limits de Gemini API
**Problema:** Las APIs de Gemini tienen límites por minuto.
| API | Límite (plan de pago) | Volumen necesario | Tiempo mínimo |
|---|---|---|---|
| Gemini 2.0 Flash (transcripción) | 1,000 RPM | 195,000 llamadas | ~3.25 horas |
| gemini-embedding-001 | 1,500 RPM | ~1,560,000 llamadas | **~17.3 horas** |

- El código actual tiene retry con backoff (`ragService.ts` línea 131-141), pero solo 100ms de delay entre batches de 10
- Sin control de rate limiting global: si 5 documentos se procesan en paralelo, cada uno genera embeddings → fácil superar 1,500 RPM
- Un 429 (rate limit) puede encadenar fallos

**Riesgo:** 🟠 ALTO - Procesamiento se frena o falla por rate limiting

---

### CRÍTICO 5: Frontend diseñado para uso individual
**Archivo:** `App.tsx` función `executeRagIngest`
**Problema:** El flujo actual es:
1. Usuario selecciona archivos en el navegador
2. Se procesan UNO A UNO con `upload-and-ingest.ts`
3. Cada uno envía base64 por HTTP (máximo 25MB por request)
4. El usuario tiene que mantener la pestaña abierta

**Para 48,000 documentos:**
- Subir 48,000 archivos desde un navegador es impracticable
- Base64 aumenta el tamaño un 33% → archivos de 15MB se convierten en 20MB en la request
- No hay resume/retry si el navegador se cierra o hay error de red

**Riesgo:** ⛔ ALTO - Necesita una herramienta de carga masiva fuera del navegador

---

### CRÍTICO 6: Conexiones de base de datos
**Problema:** Neon PostgreSQL usa pgBouncer para pooling.
- Plan Pro: ~100 conexiones simultáneas al pooler
- Si se procesan 10 documentos en paralelo, cada uno hace:
  - 1 INSERT extraction_results
  - 1 UPDATE folder_id
  - N INSERTs rag_embeddings (uno por chunk)
  - N INSERTs rag_document_chunks
- **10 docs × 20 queries = 200 queries simultáneas → agota el pool**

**Riesgo:** 🟠 ALTO - Connection timeout errors, datos inconsistentes

---

### CRÍTICO 7: Sin tracking de progreso persistente
**Problema:** No hay tabla ni mecanismo para saber:
- Qué documentos ya se procesaron
- Cuáles fallaron y por qué
- Dónde retomar si se interrumpe el proceso
- El batch-ingest.ts (`línea 197-203`) comprueba chunks existentes, pero no mantiene un log de errores persistente

**Riesgo:** 🟡 MEDIO - Si falla a mitad, no sabes dónde retomar

---

## 3. ESTIMACIÓN DE TIEMPOS

### Con la arquitectura ACTUAL (sin cambios)
| Fase | Cálculo | Tiempo |
|---|---|---|
| Transcripción Gemini | 195,000 págs × 10s/pág | 541 horas |
| Generación embeddings | 1,560,000 chunks × 0.2s | 86 horas |
| Inserción BD (1 a 1) | 1,560,000 INSERTs × 50ms | 21 horas |
| Subida Vercel Blob | 48,000 docs × 3s | 40 horas |
| **TOTAL (secuencial)** | | **~688 horas = 29 DÍAS** |

**29 días non-stop, sin fallos, sin rate limiting. Irreal.**

### Con arquitectura OPTIMIZADA (cambios propuestos)
| Fase | Cálculo | Tiempo |
|---|---|---|
| Transcripción (20 paralelo) | 195,000 / 20 × 10s | 27 horas |
| Embeddings (batch 100) | 1,560,000 / 100 × 0.5s | 2.2 horas |
| Inserción BD (bulk 100) | 15,600 bulk INSERTs × 100ms | 0.4 horas |
| Subida Blob (10 paralelo) | 48,000 / 10 × 3s | 4 horas |
| **TOTAL (optimizado)** | | **~34 horas = 1.5 DÍAS** |

### Con worker externo dedicado (máxima velocidad)
| Fase | Cálculo | Tiempo |
|---|---|---|
| Transcripción (50 paralelo) | 195,000 / 50 × 10s | 10.8 horas |
| Embeddings (batch 200) | 7,800 batches × 0.3s | 0.65 horas |
| Inserción BD (bulk 500) | 3,120 bulk INSERTs × 200ms | 0.17 horas |
| **TOTAL (worker externo)** | | **~12 horas** |

---

## 4. QUÉ PUEDE FALLAR

### Fallos probables (ocurrirán)
| Fallo | Causa | Impacto | Mitigación |
|---|---|---|---|
| Gemini 429 Rate Limit | Demasiadas peticiones/min | Procesamiento se para | Backoff exponencial + queue |
| Connection Pool Exhausted | Demasiados INSERTs simultáneos | Error 500, datos parciales | Bulk inserts, connection pooling |
| Function Timeout | Doc complejo > 120s | Doc a medio procesar | Aumentar timeout, dividir trabajo |
| Vercel KV lleno | Cola con 48K items | Queue deja de funcionar | Limpiar queue, usar BD como queue |
| Memoria insuficiente | PDF grande + base64 | Función crash | Stream processing, client upload |

### Fallos posibles (pueden ocurrir)
| Fallo | Causa | Impacto | Mitigación |
|---|---|---|---|
| Neon DB storage limit | 975K embeddings × 768 floats | DB llena | Monitorizar, plan superior |
| Vercel Blob bandwidth | 48K descargas para transcripción | Costes inesperados | Cache local, batch |
| Gemini transcripción mala | Caligrafía ilegible | Datos basura en RAG | QA por muestreo |
| Documentos duplicados | Re-procesamiento tras fallo | Embeddings duplicados | UPSERT + dedup |
| Backup falla | BD demasiado grande | Sin backup | Backup incremental |

### Fallos improbables pero graves
| Fallo | Causa | Impacto | Mitigación |
|---|---|---|---|
| Neon DB caída | Incidente proveedor | Todo parado | Backups + plan DR |
| Gemini API discontinuada | Google cambia pricing/modelo | Pipeline roto | Abstracción de modelo |
| Vercel pricing shock | Uso excesivo de funciones | Factura sorpresa | Monitorizar, alertas |

---

## 5. QUÉ SE NECESITA (requisitos por prioridad)

### IMPRESCINDIBLE (sin esto no se puede)

#### 5.1 Script de carga masiva (fuera del navegador)
Un script Node.js que se ejecute desde la línea de comandos o un servidor, que:
- Lea archivos de un directorio local o bucket
- Los suba a Vercel Blob en paralelo (10-20 concurrentes)
- Llame a Gemini para transcribir
- Inserte en BD + RAG
- Registre progreso en una tabla de tracking
- Sea resumible (si se interrumpe, continúa donde quedó)

#### 5.2 Bulk INSERT para embeddings
Cambiar `upsertEmbeddings()` de un INSERT por fila a INSERT de 100+ filas por query:
```sql
INSERT INTO rag_embeddings (document_id, user_id, ..., embedding)
VALUES
  ($1, $2, ..., $v1::vector),
  ($3, $4, ..., $v2::vector),
  ...
ON CONFLICT (document_id, chunk_index) DO UPDATE SET ...
```
**Mejora estimada: 50-100x más rápido en inserción**

#### 5.3 Tabla de tracking de procesamiento
```sql
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,                    -- agrupa un lote de procesamiento
  source_file VARCHAR(500),                  -- ruta/nombre original
  status VARCHAR(20) DEFAULT 'pending',      -- pending/uploading/transcribing/embedding/done/error
  document_id UUID,                          -- ref a extraction_results
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_batch ON processing_jobs(batch_id);
```

#### 5.4 Rate limiter global para Gemini
Control central que distribuya las llamadas a Gemini respetando los RPM:
- Semáforo de 800 RPM para transcripción (margen sobre 1,000 límite)
- Semáforo de 1,200 RPM para embeddings (margen sobre 1,500 límite)
- Cola FIFO con prioridad

### MUY RECOMENDABLE

#### 5.5 Aumentar timeouts de funciones
En `vercel.json`:
- `upload-and-ingest.ts`: de 120s → 300s
- `batch-ingest.ts`: ya tiene 300s ✅

#### 5.6 Monitoring y alertas
- Dashboard de progreso: X de 48,000 docs procesados
- Alertas cuando el rate de error > 5%
- Métricas de costes acumulados (Gemini, Blob, DB)

#### 5.7 Neon DB plan adecuado
Para 195K páginas con embeddings (768 dims):
- Embeddings: ~1.56M filas × ~6KB = **~9.4GB solo de embeddings**
- Más metadata, índices: **~15-20GB total estimado**
- Necesita plan Scale o superior de Neon (Launch: 10GB, Scale: 50GB)

### OPCIONAL PERO ÚTIL

#### 5.8 Worker externo (Cloud Run / VPS)
Un proceso Node.js persistente en Google Cloud Run o un VPS barato (€5-10/mes) que:
- Lea la tabla `processing_jobs`
- Procese documentos sin límite de 300s
- 20-50 documentos en paralelo
- Sin los límites de Vercel serverless

#### 5.9 Gemini Batch API
Google ofrece "Batch Predictions" para Vertex AI que permite enviar miles de documentos en un solo batch con costes reducidos y sin rate limits. Ideal para transcripción masiva.

---

## 6. MEJORAS DE CÓDIGO ESPECÍFICAS

### Mejora 1: Bulk INSERT de embeddings
**Archivo:** `api/lib/ragService.ts` función `upsertEmbeddings` (línea 230-263)
**Cambio:** Reemplazar loop de INSERTs individuales por batch de 100
**Impacto:** ~50-100x más rápido en inserción de embeddings
**Esfuerzo:** 2-3 horas

### Mejora 2: Batch embedding generation
**Archivo:** `api/lib/ragService.ts` función `generateEmbeddings` (línea 129-145)
**Cambio:** Usar la API de batch embeddings de Gemini (`batchEmbedContents`) en vez de llamadas individuales. Subir batch de 10 a 100.
**Impacto:** ~10x menos llamadas API, menos rate limiting
**Esfuerzo:** 2-3 horas

### Mejora 3: Retry inteligente con rate limit awareness
**Archivo:** `api/lib/ragService.ts` función `generateEmbedding` (línea 85-124)
**Cambio:** Detectar error 429, extraer header `Retry-After`, esperar el tiempo indicado
**Impacto:** Evita cascada de fallos por rate limiting
**Esfuerzo:** 1-2 horas

### Mejora 4: Connection pooling consciente
**Archivo:** `api/lib/ragService.ts` función `upsertEmbeddings`
**Cambio:** Usar transacciones (`BEGIN/COMMIT`) para agrupar inserts, liberar conexión más rápido
**Impacto:** Reduce conexiones simultáneas 80%
**Esfuerzo:** 1-2 horas

### Mejora 5: Tabla de progreso (processing_jobs)
**Archivo:** Nuevo migration + nuevo endpoint `api/processing/status.ts`
**Cambio:** Crear tabla, endpoint de status, dashboard de progreso
**Impacto:** Visibilidad total del procesamiento, resumibilidad
**Esfuerzo:** 4-6 horas

### Mejora 6: Script de carga masiva
**Archivo:** Nuevo `scripts/batch-upload.ts`
**Cambio:** Script CLI que lea archivos locales y los procese en paralelo
**Impacto:** Eliminan todos los límites del navegador
**Esfuerzo:** 8-12 horas

### Mejora 7: Endpoint de procesamiento por cron
**Archivo:** Nuevo `api/cron/process-rag-queue.ts` + actualizar `vercel.json`
**Cambio:** Cron que cada minuto procese 5-10 documentos pendientes de la tabla `processing_jobs`
**Impacto:** Procesamiento automático sin intervención del usuario
**Esfuerzo:** 4-6 horas

---

## 7. PLAN DE MEJORAS (ORDEN DE IMPLEMENTACIÓN)

| Prioridad | Mejora | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | Bulk INSERT embeddings | 2-3h | Inserción 50-100x más rápida |
| 2 | Batch embedding generation (100 en vez de 10) | 2-3h | 10x menos llamadas API |
| 3 | Tabla processing_jobs + tracking | 4-6h | Resumibilidad, visibilidad |
| 4 | Script de carga masiva (CLI) | 8-12h | Elimina límites del navegador |
| 5 | Rate limiter global Gemini | 2-3h | Evita fallos por 429 |
| 6 | Retry con Retry-After header | 1-2h | Resilencia ante rate limits |
| 7 | Cron de procesamiento automático | 4-6h | Procesamiento desatendido |
| 8 | Dashboard de progreso | 4-6h | Monitorización en tiempo real |
| **TOTAL** | | **~27-41 horas** | **~3-5 días de desarrollo** |

---

## 8. COSTES DE INFRAESTRUCTURA PARA 195K PÁGINAS

### Base de datos (Neon PostgreSQL)
| Concepto | Volumen | Coste/mes |
|---|---|---|
| Embeddings (1.56M filas × 768 floats) | ~9.4 GB | |
| Metadata + índices | ~5 GB | |
| Extraction results | ~2 GB | |
| **Total almacenamiento** | **~16 GB** | |
| **Plan necesario: Neon Scale** | 50 GB incluidos | **$69/mes** |

### Almacenamiento (Vercel Blob)
| Concepto | Volumen | Coste/mes |
|---|---|---|
| 48,000 docs × ~2MB media | ~96 GB | |
| Backups comprimidos | ~5 GB | |
| **Total** | **~100 GB** | **$15/mes** |

### Gemini API (procesamiento inicial único)
| API | Llamadas | Coste total (una vez) |
|---|---|---|
| Gemini 2.0 Flash (transcripción) | 195,000 | ~€400-800 |
| gemini-embedding-001 | 1,560,000 | ~€10-20 |
| **Total procesamiento inicial** | | **~€410-820** |

### Gemini API (consultas mensuales, 10-20 usuarios)
| Concepto | Volumen/mes | Coste/mes |
|---|---|---|
| Embeddings de consulta | ~1,000 | ~€0.50 |
| Generación de respuestas | ~1,000 | ~€5-10 |
| **Total consultas/mes** | | **~€10** |

### Vercel (hosting)
| Concepto | Coste/mes |
|---|---|
| Vercel Pro | $20 |
| Serverless functions (pico procesamiento) | $20-50 |
| Bandwidth | $10-20 |
| **Total hosting/mes** | **~$50-90** |

### Resumen costes infraestructura
| Período | Concepto | Coste |
|---|---|---|
| Único | Procesamiento IA (195K págs) | €410-820 |
| Mensual | Neon DB Scale | €69/mes |
| Mensual | Vercel Blob | €15/mes |
| Mensual | Vercel Pro + funciones | €50-90/mes |
| Mensual | Gemini consultas RAG | €10/mes |
| **Total mensual (post-procesamiento)** | | **~€144-184/mes** |
| **Total 12 meses** | procesamiento + 12×mensual | **€2,138-3,028** |

---

## 9. BACKUP DE LA APP

### Estado actual de backups
| Backup | Frecuencia | Qué incluye | Dónde |
|---|---|---|---|
| `backup-database.ts` | Diario 2 AM | Users, extractions (90 días), validations, config | Vercel Blob `database-backups/` |
| `backup-master-excel.ts` | Cada hora | Excel maestro de extracciones | Vercel Blob |
| Retención daily | 7 días | Últimos 7 backups diarios | Auto-limpieza |
| Retención weekly | 4 semanas | Últimos 4 semanales | Auto-limpieza |
| Retención monthly | 3 meses | Últimos 3 mensuales | Auto-limpieza |

### Lo que FALTA en los backups actuales
| Elemento | Estado | Riesgo |
|---|---|---|
| Código fuente (git) | ✅ En repositorio Git | Bajo |
| Embeddings RAG (1.56M filas) | ❌ NO SE BACKUPEAN | ⛔ ALTO |
| Tabla rag_document_chunks | ❌ NO SE BACKUPEA | ⛔ ALTO |
| Tabla rag_queries (auditoría) | ❌ NO SE BACKUPEA | 🟡 MEDIO |
| Tabla rag_folders | ❌ NO SE BACKUPEA | 🟡 MEDIO |
| Vercel Blob (documentos) | ❌ Sin backup externo | 🟠 ALTO |
| Variables de entorno (.env) | ❌ Solo en Vercel dashboard | 🟡 MEDIO |

### Mejoras necesarias en backups

#### A. Backup de embeddings RAG
Los embeddings representan **horas de procesamiento con Gemini**. Si se pierden, hay que re-procesar 195,000 páginas (coste: €400-800 + 12-34 horas).
- Añadir tablas `rag_embeddings`, `rag_document_chunks`, `rag_folders`, `rag_queries` al backup diario
- **ATENCIÓN:** Los embeddings son ~9.4GB → no caben en un backup JSON normal
- Solución: Backup incremental (solo nuevos embeddings desde último backup)

#### B. Backup externo de Vercel Blob
Los documentos originales (~100GB) están solo en Vercel Blob.
- Replicar a Google Cloud Storage o AWS S3 como respaldo
- O mantener una copia local/NAS del material original

#### C. Snapshot de base de datos Neon
Neon ofrece Point-in-Time Recovery (PITR) en planes superiores.
- Plan Scale incluye 7 días de PITR
- Esto protege contra borrado accidental o corrupción

#### D. Backup del código + configuración
```bash
# Crear backup completo del proyecto
git bundle create verbadocpro-backup-$(date +%Y%m%d).bundle --all
# Exportar variables de entorno
vercel env pull .env.backup
```

### Plan de backup recomendado para 195K páginas
| Elemento | Frecuencia | Destino | Retención |
|---|---|---|---|
| BD completa (Neon PITR) | Continuo | Neon (automático) | 7 días |
| Tablas core (JSON.gz) | Diario 2 AM | Vercel Blob | 30 días |
| Embeddings (incremental) | Semanal | Google Cloud Storage | 90 días |
| Documentos Blob | Único (post-subida) | GCS / NAS externo | Permanente |
| Código fuente | Cada commit | GitHub | Permanente |
| .env + secrets | Mensual | Almacén seguro offline | Permanente |

---

## 10. CREAR BACKUP INMEDIATO DE LA APP

### Paso 1: Código fuente
```bash
cd verbadocpro_pruebas
git add -A && git commit -m "Backup pre-proyecto 195K"
git push origin main
```

### Paso 2: Base de datos
```bash
# Usando pg_dump (necesita acceso directo a Neon)
pg_dump $POSTGRES_URL_NON_POOLING --no-owner --no-privileges > backup_$(date +%Y%m%d).sql
```

### Paso 3: Variables de entorno
```bash
vercel env pull .env.production.backup
```

### Paso 4: Verificar backups automáticos
- Comprobar que `api/cron/backup-database.ts` se ejecuta correctamente
- Verificar archivos en Vercel Blob `database-backups/`

---

## 11. RESUMEN EJECUTIVO

| Pregunta | Respuesta |
|---|---|
| ¿Arquitectura actual suficiente? | **NO** - 7 cuellos de botella críticos |
| ¿Cuánto tardaría sin cambios? | **~29 días** (irreal, fallaría antes) |
| ¿Cuánto con las mejoras? | **~34 horas** (1.5 días) optimizado |
| ¿Cuánto con worker externo? | **~12 horas** (máxima velocidad) |
| ¿Qué puede fallar? | Rate limits, timeouts, pool DB, memoria |
| ¿Qué se necesita? | Bulk inserts, script masivo, tracking, rate limiter |
| ¿Esfuerzo de desarrollo? | **3-5 días** de mejoras |
| ¿Coste infraestructura 12 meses? | **€2,100-3,000** |
| ¿Backups actuales suficientes? | **NO** - Faltan embeddings, blob, RAG |
| ¿Se puede hacer? | **SÍ**, con las mejoras descritas |

---

## 12. PRÓXIMOS PASOS RECOMENDADOS

1. **AHORA:** Crear backup completo (código + BD + env)
2. **Semana 1:** Implementar mejoras 1-3 (bulk inserts, batch embeddings, tracking table)
3. **Semana 1-2:** Crear script de carga masiva (mejora 4)
4. **Semana 2:** Implementar rate limiter + retry (mejoras 5-6)
5. **Semana 2:** Prueba piloto con 1,000 documentos reales del cliente
6. **Semana 3:** Ajustar según resultados del piloto
7. **Semana 3:** Actualizar plan de backups para RAG
8. **Semana 4:** Inicio procesamiento masivo de 195,000 páginas

---

*Documento generado el 9 de febrero de 2026 — VerbadocPro Europa — CONFIDENCIAL*
