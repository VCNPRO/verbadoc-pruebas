# ⚠️ CONFIGURACIONES CRÍTICAS - NO MODIFICAR SIN APROBACIÓN

Este documento lista las configuraciones críticas del sistema que **NO deben modificarse** sin aprobación explícita, ya que romperían funcionalidades clave.

---

## 1. Campos Obligatorios de Validación FUNDAE

**Archivo**: `api/_lib/validationService.ts`
**Variable**: `DEFAULT_REQUIRED_FIELDS`
**Línea**: ~124

### ✅ Configuración Correcta (NO MODIFICAR):

```typescript
const DEFAULT_REQUIRED_FIELDS = [
  'cif_empresa',           // CIF de la empresa
  'numero_expediente',     // Expediente FUNDAE
  'numero_accion',         // Número de acción formativa
  'numero_grupo'           // Número de grupo
];
```

### ❌ NO INCLUIR:
- `dni` - Los formularios FUNDAE son anónimos
- `nombre` - Protección de datos
- `apellidos` - Protección de datos
- `fecha_nacimiento` - Protección de datos
- `codigo_postal` - Protección de datos

### 🔥 Consecuencia si se modifica:
Si se añaden campos de datos personales, **todos los documentos irán a "Revisar"** por errores de validación, bloqueando el flujo automático a Excel Master.

**Histórico de cambios problemáticos:**
- `2026-01-13 10:36` - Commit 022debe: Cambió a solo `['cif']` → Roto ❌
- `2026-01-14 11:00` - Commit 42387bb: Restaurado correctamente ✅

---

## 2. Pre-validación: Nombres de Columnas Excel

**Archivo**: `api/extractions/index.ts`
**Líneas**: ~314, ~330

### ✅ Configuración Correcta (Soporta mayúsculas Y minúsculas):

```typescript
// Para Acción - línea ~314
const dataAccion = row.data?.d_cod_accion_formativa
                || row.data?.D_COD_ACCION_FORMATIVA
                || row.data?.id_accion_formativa || '';

// Para Grupo - línea ~330
const dCodGrupo = row.data?.d_cod_grupo
               || row.data?.D_COD_GRUPO
               || row.data?.codigo_grupo_detalle
               || row.data?.num_grupo || '';
```

### 🔥 Consecuencia si se modifica:
Si solo se busca en minúsculas, documentos con datos correctos irán a "No procesables" en lugar de "Excel Master".

**Histórico de cambios problemáticos:**
- `2026-01-14 10:00` - Solo minúsculas: `d_cod_grupo` → Grupo="undefined" ❌
- `2026-01-14 11:20` - Commit 4494d9b: Soporta ambos casos ✅

---

## 3. Comparación Solo de Números (Acción/Grupo)

**Archivo**: `api/extractions/index.ts`
**Líneas**: ~318, ~334

### ✅ Configuración Correcta:

```typescript
// Extraer SOLO números (obviar letras "a", "a-", "g", "g-", etc.)
const accionNumeros = dataAccionStr.replace(/[^\d]/g, '');
const grupoNumeros = dataGrupoStr.replace(/[^\d]/g, '');
```

### Por qué es necesario:
- Excel contiene: `"a - 465"`, `"g - 0424"`
- PDF extrae: `"465"`, `"0424"`
- Debemos comparar **solo los números**: `465 === 465` ✅

### 🔥 Consecuencia si se modifica:
Si se compara texto completo, **ningún documento coincidirá** y todos irán a "No procesables".

---

## 4. Timeout de Funciones Vercel

**Archivo**: `vercel.json`
**Línea**: ~41-43

### ✅ Configuración Correcta:

```json
"functions": {
  "api/process-queue.ts": {
    "maxDuration": 300
  }
}
```

### Por qué es necesario:
El procesamiento de PDFs con Gemini puede tardar varios minutos.

### 🔥 Consecuencia si se reduce:
Documentos grandes fallarán con timeout y no se procesarán.

---

## 5. Variables de Entorno Críticas

**NO publicar en el repositorio** (están en `.env.local` y Vercel):

```bash
# Base de datos PostgreSQL
POSTGRES_URL="postgresql://..."
POSTGRES_PRISMA_URL="postgresql://..."

# Google Cloud Vertex AI
GOOGLE_APPLICATION_CREDENTIALS_JSON="{...}"
GOOGLE_CLOUD_PROJECT="verbadocpro-..."

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob1_..."

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="AZe..."
```

---

## 📋 Checklist Antes de Modificar Configuraciones

Antes de modificar **cualquiera** de las configuraciones anteriores:

1. [ ] ¿Es absolutamente necesario el cambio?
2. [ ] ¿He leído y entendido las consecuencias?
3. [ ] ¿Tengo aprobación explícita?
4. [ ] ¿He hecho backup del código actual?
5. [ ] ¿Puedo revertir el cambio rápidamente si algo falla?
6. [ ] ¿He probado en desarrollo antes de producción?

---

## 🚨 Si Algo Se Rompe

### Revertir validationService.ts:
```bash
git checkout 42387bb -- api/_lib/validationService.ts
git commit -m "Revert: Restaurar validación correcta FUNDAE"
git push
```

### Revertir extractions/index.ts:
```bash
git checkout 4494d9b -- api/extractions/index.ts
git commit -m "Revert: Restaurar pre-validación correcta"
git push
```

---

**Última actualización**: 2026-01-14
**Mantenido por**: Claude Code + Equipo VerbadocPro
