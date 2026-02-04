# Guia RAG - "Preguntale al Documento"

Sistema de busqueda semantica para consultar documentos en lenguaje natural.

---

## 1. Configuracion Inicial (Solo una vez)

### Ejecutar migracion pgvector

Desde la consola del navegador (F12) en verbadocpro.eu como **admin**:

```javascript
fetch('/api/admin/run-migration-pgvector', {
  method: 'POST',
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

Respuesta esperada:
```json
{ "success": true, "components": { "extension": "vector", "table": "rag_embeddings" } }
```

---

## 2. Ingestar Documentos

### Opcion A: Ingestar un documento

```javascript
fetch('/api/rag/ingest', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documentId: 'ID-DEL-DOCUMENTO'
  })
}).then(r => r.json()).then(console.log)
```

### Opcion B: Ingestar todos los documentos

```javascript
fetch('/api/rag/batch-ingest', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    batchSize: 10  // Documentos por lote
  })
}).then(r => r.json()).then(console.log)
```

### Ver estadisticas de ingesta

```javascript
fetch('/api/rag/batch-ingest', { credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

---

## 3. Hacer Consultas

### Consulta simple

```javascript
fetch('/api/rag/ask', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: '¿Cual es el importe total de la factura?'
  })
}).then(r => r.json()).then(console.log)
```

### Consulta sobre documentos especificos

```javascript
fetch('/api/rag/ask', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: '¿Quien es el proveedor?',
    documentIds: ['id-doc-1', 'id-doc-2']
  })
}).then(r => r.json()).then(console.log)
```

### Respuesta ejemplo

```json
{
  "success": true,
  "answer": "El importe total de la factura es 1.234,56€ segun [Fuente 1].",
  "sources": [
    {
      "documentId": "abc-123",
      "documentName": "factura_001.pdf",
      "snippet": "Total factura: 1.234,56€...",
      "score": 0.89
    }
  ],
  "confidence": 0.89
}
```

---

## 4. Ver Historial de Consultas

```javascript
fetch('/api/rag/ask', { credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

---

## 5. Eliminar Documentos del Indice

### Eliminar un documento

```javascript
fetch('/api/rag/delete', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'document',
    documentId: 'ID-DEL-DOCUMENTO'
  })
}).then(r => r.json()).then(console.log)
```

### Eliminar todos los datos de un usuario (RGPD)

```javascript
fetch('/api/rag/delete', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'user',
    reason: 'Solicitud RGPD Art. 17'
  })
}).then(r => r.json()).then(console.log)
```

---

## 6. Endpoints Disponibles

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/rag/ask` | POST | Hacer consulta semantica |
| `/api/rag/ask` | GET | Ver historial de consultas |
| `/api/rag/ingest` | POST | Ingestar un documento |
| `/api/rag/batch-ingest` | POST | Ingestar multiples documentos |
| `/api/rag/batch-ingest` | GET | Ver estadisticas de ingesta |
| `/api/rag/delete` | POST | Eliminar documento/usuario |

---

## 7. Como Funciona

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Documento  │ --> │   Chunks    │ --> │  Embeddings │
│   (PDF)     │     │  (500 pal)  │     │   (768 dim) │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  pgvector   │
                                        │ (PostgreSQL)│
                                        └─────────────┘
                                               │
┌─────────────┐     ┌─────────────┐           │
│  Respuesta  │ <-- │   Gemini    │ <---------┘
│  + Fuentes  │     │  2.0 Flash  │   Contexto relevante
└─────────────┘     └─────────────┘
```

---

## 8. Preguntas Frecuentes

### ¿Cuantos documentos puedo ingestar?
- Con Vercel Pro: ~50,000+ documentos
- Depende del tamano del texto extraido

### ¿Cuanto tarda la ingesta?
- ~2-5 segundos por documento
- 100 documentos ≈ 5-10 minutos

### ¿Que pasa si subo un documento nuevo?
- Debes ingestarlo manualmente con `/api/rag/ingest`
- O configurar ingesta automatica (pendiente)

### ¿Los datos estan seguros?
- Todo en Vercel Postgres (EU)
- Aislamiento por usuario (RLS)
- Cumplimiento RGPD/ENS

---

## 9. Ejemplos de Preguntas

```
"¿Cual es el NIF del cliente?"
"¿Que productos aparecen en la factura?"
"¿Cual es la fecha de vencimiento?"
"Resume el contenido del contrato"
"¿Quien firma el documento?"
"¿Cual es el importe del IVA?"
```

---

## 10. Troubleshooting

### Error: "No se encontraron documentos"
- Verifica que has ingestado documentos
- Ejecuta `/api/rag/batch-ingest` GET para ver estadisticas

### Error: "GEMINI_API_KEY no configurada"
- Verifica variables de entorno en Vercel

### Respuestas poco precisas
- Ingesta mas documentos
- Se mas especifico en la pregunta
- Usa `documentIds` para limitar la busqueda
