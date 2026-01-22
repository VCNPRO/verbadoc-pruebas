# 📡 API ENDPOINTS - VERBADOCPRO

Documentación completa de los endpoints REST API para el sistema de procesamiento de formularios FUNDAE.

**Base URL:** `https://www.verbadocpro.eu/api`

---

## 🔐 Autenticación

Todos los endpoints requieren autenticación mediante cookie **httpOnly** con JWT.

```
Cookie: auth-token=<JWT_TOKEN>
```

**Headers requeridos:**
```
Content-Type: application/json
```

---

## 📋 EXTRACCIONES (Formularios Procesados)

### 1. **GET /api/extractions**
Obtener lista de extracciones del usuario autenticado.

**Query Parameters:**
- `limit` (opcional): Número máximo de resultados (default: 50)
- `needsReview` (opcional): Si es "true", solo devuelve las que necesitan revisión
- `status` (opcional): Filtrar por estado específico

**Response 200:**
```json
{
  "extractions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "filename": "formulario_001.pdf",
      "file_url": "https://...",
      "file_type": "application/pdf",
      "file_size_bytes": 2345678,
      "page_count": 2,
      "extracted_data": {
        "cif": "B12345678",
        "expediente": "FUNDAE2024-001",
        "dni": "12345678A",
        "valoracion": {
          "pregunta1": 4,
          "pregunta2": 3
        }
      },
      "validation_status": "needs_review",
      "validation_errors_count": 3,
      "model_used": "gemini-2.5-flash",
      "processing_time_ms": 35000,
      "confidence_score": 0.95,
      "created_at": "2026-01-08T18:30:00Z",
      "updated_at": "2026-01-08T18:30:00Z"
    }
  ],
  "stats": {
    "total": 150,
    "pending": 10,
    "valid": 120,
    "needsReview": 15,
    "rejected": 5
  },
  "count": 50
}
```

**Ejemplo cURL:**
```bash
curl -X GET https://www.verbadocpro.eu/api/extractions?limit=10 \
  -H "Cookie: auth-token=YOUR_TOKEN"
```

**Ejemplo JavaScript:**
```javascript
const response = await fetch('/api/extractions?needsReview=true');
const data = await response.json();

console.log(`Formularios pendientes: ${data.count}`);
data.extractions.forEach(ex => {
  console.log(`- ${ex.filename}: ${ex.validation_errors_count} errores`);
});
```

---

### 2. **POST /api/extractions**
Crear una nueva extracción (después de procesar con IA).

**Request Body:**
```json
{
  "filename": "formulario_001.pdf",
  "extractedData": {
    "cif": "B12345678",
    "expediente": "FUNDAE2024-001",
    "dni": "12345678A",
    "nombre": "Juan Pérez",
    "ciudad": "Barcelona",
    "valoracion": {
      "pregunta1": 4,
      "pregunta2": 3,
      "pregunta3": "NC"
    }
  },
  "modelUsed": "gemini-2.5-flash",
  "fileUrl": "https://blob.vercel-storage.com/...",
  "fileType": "application/pdf",
  "fileSizeBytes": 2345678,
  "pageCount": 2,
  "processingTimeMs": 35000,
  "confidenceScore": 0.95
}
```

**Campos requeridos:**
- `filename` (string)
- `extractedData` (object - JSON flexible)
- `modelUsed` (string)

**Campos opcionales:**
- `fileUrl`, `fileType`, `fileSizeBytes`, `pageCount`, `processingTimeMs`, `confidenceScore`

**Response 201:**
```json
{
  "success": true,
  "extraction": {
    "id": "uuid-generado",
    "user_id": "uuid",
    "filename": "formulario_001.pdf",
    "extracted_data": { ... },
    "validation_status": "pending",
    "created_at": "2026-01-08T18:30:00Z"
  }
}
```

**Ejemplo cURL:**
```bash
curl -X POST https://www.verbadocpro.eu/api/extractions \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "filename": "formulario_001.pdf",
    "extractedData": {"cif": "B12345678"},
    "modelUsed": "gemini-2.5-flash"
  }'
```

**Ejemplo JavaScript:**
```javascript
const extraction = await fetch('/api/extractions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: 'formulario_001.pdf',
    extractedData: {
      cif: 'B12345678',
      expediente: 'FUNDAE2024-001',
      dni: '12345678A'
    },
    modelUsed: 'gemini-2.5-flash',
    processingTimeMs: 35000
  })
});

const data = await extraction.json();
console.log('Extracción creada:', data.extraction.id);
```

---

### 3. **GET /api/extractions/:id**
Obtener una extracción específica con sus errores de validación.

**URL Parameters:**
- `id` (uuid): ID de la extracción

**Response 200:**
```json
{
  "extraction": {
    "id": "uuid",
    "user_id": "uuid",
    "filename": "formulario_001.pdf",
    "extracted_data": { ... },
    "validation_status": "needs_review",
    "validation_errors_count": 3,
    ...
  },
  "errors": [
    {
      "id": "error-uuid-1",
      "extraction_id": "uuid",
      "field_name": "valoracion.pregunta3",
      "error_type": "multiple_answers",
      "error_message": "Se detectaron múltiples respuestas (2, 3)",
      "severity": "warning",
      "invalid_value": "[2, 3]",
      "suggested_correction": "NC",
      "status": "pending",
      "created_at": "2026-01-08T18:30:00Z"
    }
  ],
  "errorsCount": 3
}
```

**Ejemplo cURL:**
```bash
curl -X GET https://www.verbadocpro.eu/api/extractions/abc-123-def \
  -H "Cookie: auth-token=YOUR_TOKEN"
```

**Ejemplo JavaScript:**
```javascript
const response = await fetch(`/api/extractions/${extractionId}`);
const data = await response.json();

console.log(`Formulario: ${data.extraction.filename}`);
console.log(`Errores: ${data.errorsCount}`);

data.errors.forEach(error => {
  console.log(`- ${error.field_name}: ${error.error_message}`);
  if (error.suggested_correction) {
    console.log(`  Sugerencia: ${error.suggested_correction}`);
  }
});
```

---

### 4. **PATCH /api/extractions/:id**
Actualizar una extracción existente.

**URL Parameters:**
- `id` (uuid): ID de la extracción

**Request Body:**
```json
{
  "extractedData": {
    "cif": "B12345678",
    "valoracion": {
      "pregunta3": "NC"
    }
  },
  "validationStatus": "valid",
  "rejectionReason": null
}
```

**Campos opcionales:**
- `extractedData` (object): Nuevos datos extraídos
- `validationStatus` (string): Nuevo estado
- `rejectionReason` (string): Motivo de rechazo

**Response 200:**
```json
{
  "success": true,
  "extraction": {
    "id": "uuid",
    "extracted_data": { ... },
    "validation_status": "valid",
    "updated_at": "2026-01-08T19:00:00Z"
  }
}
```

---

### 5. **DELETE /api/extractions/:id**
Eliminar una extracción.

**URL Parameters:**
- `id` (uuid): ID de la extracción

**Response 200:**
```json
{
  "success": true,
  "message": "Extracción eliminada correctamente"
}
```

**Ejemplo cURL:**
```bash
curl -X DELETE https://www.verbadocpro.eu/api/extractions/abc-123-def \
  -H "Cookie: auth-token=YOUR_TOKEN"
```

---

### 6. **POST /api/extractions/:id/approve**
Aprobar un formulario (marca como válido y corregido).

**URL Parameters:**
- `id` (uuid): ID de la extracción

**Request Body:**
```json
{
  "notes": "Revisado y validado manualmente"
}
```

**Campos opcionales:**
- `notes` (string): Notas sobre la aprobación

**Response 200:**
```json
{
  "success": true,
  "message": "Formulario aprobado correctamente",
  "extraction": {
    "id": "uuid",
    "validation_status": "approved",
    "has_corrections": true,
    "corrected_by_user_id": "uuid",
    "corrected_at": "2026-01-08T19:00:00Z",
    "correction_notes": "Revisado y validado manualmente"
  }
}
```

**Ejemplo cURL:**
```bash
curl -X POST https://www.verbadocpro.eu/api/extractions/abc-123-def/approve \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{"notes": "Todo correcto"}'
```

**Ejemplo JavaScript:**
```javascript
await fetch(`/api/extractions/${extractionId}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ notes: 'Revisado y validado' })
});

console.log('✅ Formulario aprobado');
```

---

### 7. **POST /api/extractions/:id/reject**
Rechazar un formulario (marca como inválido).

**URL Parameters:**
- `id` (uuid): ID de la extracción

**Request Body:**
```json
{
  "reason": "No coincide con el Excel del cliente - CIF no encontrado"
}
```

**Campos requeridos:**
- `reason` (string): Motivo de rechazo

**Response 200:**
```json
{
  "success": true,
  "message": "Formulario rechazado correctamente",
  "extraction": {
    "id": "uuid",
    "validation_status": "rejected",
    "rejection_reason": "No coincide con el Excel del cliente - CIF no encontrado"
  }
}
```

**Ejemplo cURL:**
```bash
curl -X POST https://www.verbadocpro.eu/api/extractions/abc-123-def/reject \
  -H "Content-Type": application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{"reason": "Datos inválidos"}'
```

---

## ⚠️ ERRORES DE VALIDACIÓN

### 8. **POST /api/validation-errors/:id/fix**
Corregir un error de validación específico.

**URL Parameters:**
- `id` (uuid): ID del error de validación

**Request Body:**
```json
{
  "correctedValue": "NC",
  "notes": "Marcado como NC según regla de múltiples respuestas"
}
```

**Campos requeridos:**
- `correctedValue` (any): Valor corregido

**Campos opcionales:**
- `notes` (string): Notas sobre la corrección

**Response 200:**
```json
{
  "success": true,
  "message": "Error corregido correctamente",
  "correctedValue": "NC"
}
```

**Ejemplo JavaScript:**
```javascript
// Corregir un error de múltiples respuestas
await fetch(`/api/validation-errors/${errorId}/fix`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    correctedValue: 'NC',
    notes: 'Auto-corregido según regla'
  })
});

// Corregir un CIF inválido
await fetch(`/api/validation-errors/${errorId}/fix`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    correctedValue: 'B12345678',
    notes: 'CIF corregido manualmente'
  })
});
```

---

### 9. **POST /api/validation-errors/:id/ignore**
Ignorar un error de validación (no crítico).

**URL Parameters:**
- `id` (uuid): ID del error de validación

**Request Body:**
```json
{
  "notes": "Error no crítico, se puede ignorar"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Error ignorado correctamente"
}
```

---

## 🔒 Códigos de Error

**400 Bad Request:**
- Faltan campos requeridos
- Formato de datos inválido

**401 Unauthorized:**
- No autenticado (falta cookie de JWT)
- Token expirado o inválido

**403 Forbidden:**
- No tienes permiso para acceder a este recurso
- Solo puedes ver/modificar tus propias extracciones (excepto admins)

**404 Not Found:**
- Extracción o error no encontrado
- ID inválido

**405 Method Not Allowed:**
- Método HTTP no soportado para este endpoint

**500 Internal Server Error:**
- Error en el servidor o base de datos
- Verifica los logs en Vercel

---

## 🎯 Flujo Completo de Procesamiento

### Paso 1: Usuario sube un PDF
```javascript
// En App.tsx después de procesar con Gemini
const extractedData = await geminiService.extract(pdfFile);
```

### Paso 2: Crear extracción en BD
```javascript
const extraction = await fetch('/api/extractions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: pdfFile.name,
    extractedData: extractedData,
    modelUsed: 'gemini-2.5-flash',
    processingTimeMs: 35000
  })
});

const { extraction: savedExtraction } = await extraction.json();
```

### Paso 3: Validar datos (si hay errores)
```javascript
// Validar con reglas
const errors = validateFormData(extractedData);

if (errors.length > 0) {
  // Crear errores en BD
  for (const error of errors) {
    await ValidationErrorDB.create({
      extractionId: savedExtraction.id,
      fieldName: error.field,
      errorType: error.type,
      errorMessage: error.message,
      suggestedCorrection: error.correction
    });
  }

  // Marcar como "needs_review"
  await fetch(`/api/extractions/${savedExtraction.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ validationStatus: 'needs_review' })
  });

  // Enviar email automático (Fase 4)
  await EmailService.notifyNeedsReview(savedExtraction, errors);
}
```

### Paso 4: Usuario corrige errores
```javascript
// En el front de revisión
await fetch(`/api/validation-errors/${errorId}/fix`, {
  method: 'POST',
  body: JSON.stringify({ correctedValue: 'NC' })
});
```

### Paso 5: Aprobar formulario
```javascript
await fetch(`/api/extractions/${extractionId}/approve`, {
  method: 'POST',
  body: JSON.stringify({ notes: 'Todo correcto' })
});
```

---

## 📊 Ejemplos de Uso Avanzado

### Obtener estadísticas del usuario
```javascript
const response = await fetch('/api/extractions?limit=0');
const { stats } = await response.json();

console.log(`
📊 ESTADÍSTICAS:
- Total procesado: ${stats.total}
- ✅ Válidos: ${stats.valid}
- ⏳ Pendientes: ${stats.pending}
- ⚠️ Necesitan revisión: ${stats.needsReview}
- ❌ Rechazados: ${stats.rejected}
`);
```

### Procesar batch de formularios
```javascript
async function processBatch(pdfFiles) {
  const results = [];

  for (const file of pdfFiles) {
    // 1. Extraer con IA
    const extractedData = await geminiService.extract(file);

    // 2. Guardar en BD
    const response = await fetch('/api/extractions', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        extractedData,
        modelUsed: 'gemini-2.5-flash'
      })
    });

    const { extraction } = await response.json();
    results.push(extraction);

    console.log(`✅ ${file.name} procesado: ${extraction.id}`);
  }

  return results;
}

// Procesar 100 formularios
const extractions = await processBatch(pdfFiles);
console.log(`✅ ${extractions.length} formularios procesados`);
```

---

## 🚀 Próximos Endpoints (Fases 3-6)

**Fase 3: Integración con localStorage**
- Migrar código actual de App.tsx para usar estos endpoints

**Fase 4: Sistema de emails**
- POST `/api/notifications/send` - Enviar email manualmente
- GET `/api/notifications` - Ver log de emails

**Fase 5: Front de revisión**
- GET `/api/extractions/needs-review` - Lista para el panel de revisión

**Fase 6: Validación con reglas**
- POST `/api/extractions/:id/validate` - Validar contra Excel del cliente
- POST `/api/extractions/:id/translate-cities` - Traducir códigos de ciudades

---

**Fecha:** 2026-01-08
**Proyecto:** verbadocpro
**Versión API:** v1.0
**Base URL:** https://www.verbadocpro.eu/api
