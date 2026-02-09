# Informe de Trabajo: Redireccion Automatica a RAG sin Esquema

**Proyecto:** VerbaDoc Enterprise
**Fecha:** 2026-02-09
**Commit:** `fe510f5` en rama `main`
**Archivo modificado:** `App.tsx` (2 ubicaciones)
**Archivos NO modificados:** `services/geminiService.ts`, `api/rag/upload-and-ingest.ts`

---

## 1. Problema

Cuando un usuario subia un documento (ej: manuscrito JPG) al lote de extraccion **sin tener una plantilla/esquema configurado**, el sistema fallaba con:

> "El esquema esta vacio o no contiene campos con nombre validos"

El archivo quedaba marcado como **"no procesable"** y no se podia hacer nada mas con el.

## 2. Solucion Implementada

Se intercepta la condicion de esquema vacio **antes** de llamar a `extractWithHybridSystem` y se redirige automaticamente al endpoint RAG (`/api/rag/upload-and-ingest`) para transcripcion e indexacion.

### Flujo resultante

```
Usuario sube archivo -> FileUploader
    |
    +-- JSON               -> Parse directo (sin cambios)
    |
    +-- Schema vacio        -> [NUEVO] Envio automatico a RAG
    |                           +-- Gemini transcribe/analiza el contenido
    |                           +-- Se genera embedding y se indexa en pgvector
    |                           +-- El archivo queda buscable por lenguaje natural
    |                           +-- Se marca como "completado" en el frontend
    |
    +-- Schema con campos   -> Extraccion IDP normal (extractWithHybridSystem)
                                (sin cambios)
```

### Detalle tecnico del cambio

En `App.tsx`, dentro de las dos funciones `processFile` (una en `handleExtractSelected` ~linea 428, otra en `handleExtractAll` ~linea 759), se anadio un bloque `else if` entre el caso JSON y el caso IDP:

```typescript
} else if (schema.filter(f => f.name.trim() !== '').length === 0) {
    // Sin esquema configurado -> redirigir al sistema RAG
    console.log(`Sin esquema configurado, redirigiendo a RAG: ${file.file.name}`);

    // Convertir ArrayBuffer a base64
    const fileBase64 = new Uint8Array(fileBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte), ''
    );

    // POST al endpoint RAG
    const ragResponse = await fetch('/api/rag/upload-and-ingest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename: file.file.name,
            fileBase64: btoa(fileBase64),
            fileType: file.file.type || 'application/pdf',
            fileSizeBytes: file.file.size,
        }),
    });

    // Marcar como completado + agregar al historial
    // ... (ver codigo completo en App.tsx)
    return;
} else {
    // Flujo IDP normal (sin cambios)
}
```

### Flags en extractedData

Los documentos redirigidos a RAG se identifican con dos flags:

| Flag | Valor | Proposito |
|------|-------|-----------|
| `_ragRedirect` | `true` | Indica que fue redirigido automaticamente (no subido manualmente a RAG) |
| `_ragDocument` | `true` | Compatible con el flujo RAG existente para visualizacion en resultados |

---

## 3. Arquitectura del Sistema RAG (como procesa archivos)

### Endpoint: `/api/rag/upload-and-ingest.ts`

1. **Recibe** el archivo en base64
2. **Sube** a Vercel Blob (`rag-documents/{userId}/{timestamp}-{filename}`)
3. **Extrae contenido** via Gemini 2.0 Flash:
   - **PDFs:** Prompt = "Extrae TODO el texto de este documento"
   - **Imagenes:** Prompt = Descripcion visual + OCR combinados
   - **Audio:** Transcripcion completa con identificacion de interlocutores
4. **Guarda** referencia en `extraction_results` con `model_used = 'rag-direct'`
5. **Ingesta** al sistema RAG (chunking + embeddings + pgvector)
6. **Retorna:** `{ documentId, blobUrl, description, ingestion: { chunksCreated, vectorsUploaded } }`

### Servicio RAG: `api/lib/ragService.ts`

#### Chunking inteligente (`chunkTextSmart`)
- Divide el texto por **oraciones** (no por caracteres ni paginas)
- Tamano maximo por chunk: **500 palabras**
- Overlap entre chunks: **50 palabras**
- Un PDF de 10 paginas genera tipicamente **5-15 chunks**

#### Embeddings (`generateEmbeddings`)
- Genera vectores para cada chunk
- Se almacenan en `rag_embeddings` (pgvector)

#### Indexacion (`upsertEmbeddings`)
- Cada chunk se guarda con: `document_id`, `chunk_index`, `chunk_text`, `embedding`
- Constraint: `ON CONFLICT (document_id, chunk_index)` -> actualiza si ya existe

---

## 4. Modelo de Datos

### Relacion documento-chunks (integridad referencial)

```
extraction_results (1 registro por archivo)
  id = "abc-123"                  <-- documentId unico
  filename = "manuscrito.pdf"
  extracted_data = { _ragDocument: true, description: "..." }
  pdf_blob_url = "https://blob.vercel-storage.com/..."
  model_used = "rag-direct"
        |
        +--- rag_document_chunks (N registros por archivo)
        |      document_id = "abc-123"
        |      chunk_index = 0, 1, 2, ...
        |      chunk_text = "texto del chunk..."
        |      pinecone_id = "abc-123_chunk_0"
        |
        +--- rag_embeddings (N registros por archivo)
               document_id = "abc-123"
               chunk_index = 0, 1, 2, ...
               chunk_text = "texto del chunk..."
               embedding = vector(768)
```

**Todos los chunks comparten el mismo `document_id`.** No se pierde la vinculacion al archivo original independientemente de cuantos chunks se generen.

---

## 5. Procesamiento de Archivos Multipagina

### Comportamiento actual
- El PDF completo se envia a Gemini como **un solo bloque** via `inlineData`
- Gemini lee **todas las paginas** y devuelve texto concatenado
- El texto se trocea por oraciones, **no por paginas**
- No hay marcadores de pagina en los chunks

### Limites operativos

| Limite | Valor | Impacto |
|--------|-------|---------|
| Vercel body size (Pro) | ~4.5 MB | PDF en base64 pesa ~1.33x el original. Limite real: PDFs de ~3.4 MB |
| Gemini inline data | ~20 MB | Raramente es cuello de botella |
| maxDuration del endpoint | 120 segundos | Suficiente para 10 paginas, ajustado para +20 |
| Chunk size | 500 palabras | ~5-15 chunks por documento de 10 paginas |
| Chunk overlap | 50 palabras | Continuidad semantica entre chunks |

### Mejora posible: extraccion pagina por pagina
Si se necesita saber de que pagina proviene cada fragmento:
1. Extraer texto **por pagina** (N llamadas a Gemini)
2. Concatenar con marcadores: `[Pagina 1]\n...texto...\n[Pagina 2]\n...`
3. El `documentId` sigue siendo unico — no se fragmenta el archivo
4. Beneficio: poder citar "pagina X" en respuestas del chat RAG

---

## 6. Verificacion

| Caso de prueba | Resultado esperado |
|----------------|-------------------|
| Subir manuscrito JPG **sin plantilla** | Redireccion a RAG, estado "completado", descripcion visible |
| Subir PDF **con plantilla configurada** | Flujo IDP normal (extractWithHybridSystem) |
| Archivo redirigido a RAG | Aparece buscable en "Preguntale al Documento" |
| Error en endpoint RAG | Se muestra error (catch existente lo maneja) |

---

## 7. Archivos del Sistema Relevantes

| Archivo | Funcion |
|---------|---------|
| `App.tsx` | Orquestacion del procesamiento (donde se hizo el cambio) |
| `api/rag/upload-and-ingest.ts` | Endpoint RAG: subida + extraccion + ingesta |
| `api/lib/ragService.ts` | Chunking, embeddings, busqueda semantica |
| `services/geminiService.ts` | Extraccion IDP (NO modificado, validacion de esquema sigue como proteccion) |
| `vercel.json` | Configuracion de maxDuration por endpoint |

---

*Informe generado el 2026-02-09 para archivo interno del proyecto VerbaDoc Enterprise.*
