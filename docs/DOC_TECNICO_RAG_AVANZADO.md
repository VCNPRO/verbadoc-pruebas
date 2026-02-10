# Documento Tecnico Interno: Sistema RAG - Configuracion Avanzada

**VerbadocPro** | Version 2.0 | Febrero 2026
**Clasificacion: INTERNO - Equipo de Desarrollo**

---

## 1. Arquitectura del Pipeline RAG

```
┌─────────────┐    ┌───────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  Frontend    │───>│  Query        │───>│  Embedding   │───>│  pgvector    │───>│  Generacion  │
│  RAGSearch   │    │  Rewriting    │    │  768 dims    │    │  Busqueda    │    │  LLM Gemini  │
│  Panel.tsx   │    │  (si history) │    │  cosine sim  │    │  + Threshold │    │  + Historial │
└─────────────┘    └───────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
      │                                                                              │
      │◄─────────────────────── Respuesta + Fuentes + Confianza ◄────────────────────│
```

### Flujo completo (ragQuery)

1. **Query Rewriting** (condicional): Si `chatHistory.length > 0`, el modelo `gemini-2.0-flash` reescribe la pregunta para hacerla autonoma
2. **Embedding**: `gemini-embedding-001` genera vector 768 dimensiones
3. **Busqueda vectorial**: pgvector `<=>` (distancia coseno) en PostgreSQL, top K resultados
4. **Filtro threshold**: Si `similarityThreshold > 0`, elimina resultados con score < threshold
5. **Generacion**: Modelo seleccionado genera respuesta con contexto + historial

---

## 2. Parametros de Configuracion (RAGConfig)

### 2.1 Interfaz TypeScript

```typescript
interface RAGConfig {
  temperature: number;          // 0.0 - 1.0 (default: 0.3)
  topK: number;                 // 1 - 10 (default: 5)
  similarityThreshold: number;  // 0.0 - 1.0 (default: 0.0)
  model: string;                // Ver modelos disponibles
  chatHistory?: ChatMessage[];  // Max 10 mensajes (5 pares)
}
```

### 2.2 Tabla de Parametros

| Parametro | Tipo | Rango | Default | Validacion Backend |
|-----------|------|-------|---------|-------------------|
| `temperature` | float | 0.0 - 1.0 | 0.3 | `Math.min(Math.max(0.0, val), 1.0)` |
| `topK` | int | 1 - 10 | 5 | `Math.min(Math.max(1, val), 10)` |
| `similarityThreshold` | float | 0.0 - 1.0 | 0.0 | `Math.min(Math.max(0.0, val), 1.0)` |
| `model` | string | enum | gemini-2.0-flash | Validado contra `AVAILABLE_MODELS` |
| `chatHistory` | array | max 10 items | [] | Filtrado por role + content validos |

### 2.3 Modelos Disponibles

| Modelo | ID API | Velocidad | Precision | Tokens | Caso de uso |
|--------|--------|-----------|-----------|--------|-------------|
| **Gemini 2.0 Flash** | `gemini-2.0-flash` | Muy rapida (~1-2s) | Buena | 1M | Consultas rapidas, uso general, alto volumen |
| **Gemini 2.5 Flash Preview** | `gemini-2.5-flash-preview` | Rapida (~2-4s) | Muy buena | 1M | Equilibrio velocidad/calidad, razonamiento |
| **Gemini 1.5 Pro** | `gemini-1.5-pro` | Moderada (~3-6s) | Excelente | 2M | Analisis complejo, documentos largos, maxima precision |

---

## 3. Detalle de Cada Parametro

### 3.1 Temperature (Temperatura)

Controla la aleatoriedad de la respuesta del modelo.

| Valor | Comportamiento | Ejemplo de uso |
|-------|----------------|----------------|
| **0.0** | Determinista. Misma pregunta = misma respuesta | Extraccion de datos exactos: "Cual es el NIF del proveedor?" |
| **0.1 - 0.3** | Conservador. Respuestas fieles al texto | **Default**. Consultas factuales sobre documentos |
| **0.4 - 0.6** | Balanceado. Algo de variacion | Resumenes, explicaciones con algo de creatividad |
| **0.7 - 1.0** | Creativo. Respuestas mas variadas | Brainstorming sobre contenido, multiples interpretaciones |

**Recomendacion interna**: Para uso empresarial/legal, mantener entre 0.1-0.3. Valores altos pueden generar "alucinaciones" aunque el prompt lo mitiga.

### 3.2 Top K (Numero de Fuentes)

Cuantos fragmentos de documento se envian al modelo como contexto.

| Valor | Tokens aprox. | Comportamiento |
|-------|---------------|----------------|
| **1-2** | 500-1000 | Respuesta rapida, focalizada en el fragmento mas relevante |
| **3-5** | 1500-2500 | **Default**. Buen balance cobertura/velocidad |
| **6-8** | 3000-4000 | Mas contexto. Util para preguntas que cruzan secciones |
| **9-10** | 4500-5000 | Maximo contexto. Para documentos largos con informacion dispersa |

**Impacto en coste**: Cada fragmento adicional suma ~500 tokens al prompt. Con gemini-2.0-flash es negligible, con gemini-1.5-pro impacta en latencia.

### 3.3 Similarity Threshold (Umbral de Similitud)

Score minimo de similitud coseno para incluir un fragmento. Se aplica POST-busqueda.

| Valor | Efecto | Caso de uso |
|-------|--------|-------------|
| **0.00** | Sin filtro (default). Devuelve siempre topK resultados | Uso general, documentos variados |
| **0.10 - 0.30** | Filtro suave. Elimina solo resultados irrelevantes | Colecciones grandes con mucho ruido |
| **0.40 - 0.60** | Filtro moderado. Solo resultados razonablemente relevantes | Busquedas precisas en documentos tecnicos |
| **0.70 - 0.90** | Filtro estricto. Solo coincidencias muy cercanas | Cuando la precision es critica (legal, compliance) |
| **0.95+** | Ultrapreciso. Casi solo coincidencias literales | Busqueda de frases exactas o datos especificos |

**IMPORTANTE**: Un threshold alto puede devolver 0 resultados, activando el mensaje "No tengo informacion". El log muestra `[RAG] Threshold 0.8: 5 -> 2 resultados` para diagnostico.

### 3.4 Chat History (Historial de Conversacion)

Permite preguntas de seguimiento sin repetir contexto.

**Mecanismo**:
1. Frontend mantiene buffer circular de max 10 mensajes (5 pares user/assistant)
2. Si hay historial, se ejecuta **query rewriting** con `gemini-2.0-flash` (temp 0.1)
3. La query reescrita se usa para el embedding y la busqueda
4. El historial se inyecta en el prompt de generacion como mensajes previos

**Ejemplo de rewriting**:
```
Historial:
  User: "Quien es el proveedor del contrato?"
  Assistant: "El proveedor es Iberdrola S.A., segun [Fuente: Contrato_2024.pdf]"

Nueva pregunta: "Y cual es su NIF?"

Query reescrita: "Cual es el NIF de Iberdrola S.A., el proveedor del contrato?"
```

---

## 4. System Prompt (Prompt del Sistema)

### Prompt actual (v2.0)

```
Eres un asistente experto, veraz y proactivo que responde preguntas
basandose UNICAMENTE en los documentos proporcionados.

PERSONA: Eres un analista documental profesional. Tu objetivo es dar
respuestas precisas, utiles y bien fundamentadas.

REGLAS ESTRICTAS:
1. Responde SOLO con informacion contenida en los documentos.
2. VERACIDAD: Si la informacion NO esta en los documentos, responde:
   "No tengo informacion sobre esto en los documentos proporcionados.
    Te gustaria que busque sobre un tema relacionado?"
3. CLARIFICACION: Si la pregunta es ambigua, pide aclaracion.
4. CITAS OBLIGATORIAS: Cita siempre [Fuente: NombreArchivo.pdf].
5. Se preciso, estructurado y conciso. Usa listas si mejoran claridad.
6. [Instruccion de idioma segun configuracion]
```

### Cambios vs v1.0

| Aspecto | v1.0 (anterior) | v2.0 (actual) |
|---------|-----------------|---------------|
| Persona | Generica | Analista documental profesional |
| Veracidad | "Dilo claramente" | Mensaje especifico + oferta de busqueda alternativa |
| Clarificacion | No existia | Pide aclaracion si pregunta es vaga |
| Citas | `[Fuente X]` generico | `[Fuente: NombreArchivo.pdf]` con nombre real |
| Estructura | No mencionada | Listas y tablas si mejoran claridad |

---

## 5. Endpoints API

### POST /api/rag/ask

**Request body**:
```json
{
  "query": "Cual es el importe total del contrato?",
  "topK": 5,
  "folderId": "uuid-carpeta",
  "language": "es",
  "temperature": 0.3,
  "similarityThreshold": 0.0,
  "model": "gemini-2.0-flash",
  "chatHistory": [
    { "role": "user", "content": "Quien firmo el contrato?" },
    { "role": "assistant", "content": "El contrato fue firmado por..." }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "answer": "El importe total del contrato es de 45.000 EUR [Fuente: Contrato_2024.pdf]",
  "sources": [
    {
      "documentId": "uuid",
      "documentName": "Contrato_2024.pdf",
      "chunkIndex": 3,
      "snippet": "...clausula quinta establece un importe de 45.000...",
      "score": 0.87,
      "documentUrl": "https://blob.vercel.com/...",
      "fileType": "application/pdf"
    }
  ],
  "confidence": 0.87,
  "processingTimeMs": 1840,
  "tokensUsed": 1523
}
```

---

## 6. Logs de Diagnostico

Formato de logs en consola de Vercel:

```
[RAG/Ask] User abc123 query: "Cual es el NIF..." model=gemini-2.0-flash temp=0.3 threshold=0 history=4
[RAG] Consulta usuario abc123: "Cual es el NIF de Iberdrola..." [es] modelo=gemini-2.0-flash temp=0.3
[RAG] Query reescrita: "Y su NIF?" -> "Cual es el NIF de Iberdrola S.A.?"
[RAG] Threshold 0.5: 5 -> 3 resultados
```

---

## 7. Consideraciones de Rendimiento

| Modelo | Latencia tipica | Coste relativo | Tokens/min (rate limit) |
|--------|----------------|----------------|------------------------|
| gemini-2.0-flash | 1-2s | 1x | 4M |
| gemini-2.5-flash-preview | 2-4s | 1.5x | 2M |
| gemini-1.5-pro | 3-6s | 3x | 1M |

**Query rewriting** anade ~0.5-1s de latencia (solo cuando hay historial).

**Embedding** (gemini-embedding-001): ~0.2-0.5s por consulta (invariable).

---

## 8. Seguridad y RGPD

- Todos los parametros se validan y clampean en el backend (ask.ts)
- chatHistory se sanitiza: solo objetos con `role` valido y `content` string
- chatHistory no se persiste en BD (solo en memoria del navegador)
- Los logs de auditoria (rag_queries) registran query + response + confidence
- Datos almacenados en EU (Vercel Postgres region eu-central-1)

---

## 9. Testing Manual

### Test 1: Defaults (regresion)
```bash
curl -X POST https://verbadocpro.eu/api/rag/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: session=TOKEN" \
  -d '{"query":"Resumen del documento","language":"es"}'
```
Esperado: Respuesta con temp=0.3, topK=5, modelo=gemini-2.0-flash

### Test 2: Modelo y temperatura
```bash
curl -X POST https://verbadocpro.eu/api/rag/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: session=TOKEN" \
  -d '{"query":"Resumen del documento","model":"gemini-1.5-pro","temperature":0.7}'
```
Esperado: Respuesta mas elaborada, algo mas lenta

### Test 3: Threshold estricto
```bash
curl -X POST https://verbadocpro.eu/api/rag/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: session=TOKEN" \
  -d '{"query":"receta de paella","similarityThreshold":0.8}'
```
Esperado: "No tengo informacion sobre esto..." (si no hay docs de cocina)

### Test 4: Historial conversacional
```bash
curl -X POST https://verbadocpro.eu/api/rag/ask \
  -H "Content-Type: application/json" \
  -H "Cookie: session=TOKEN" \
  -d '{
    "query":"Y cuanto dura?",
    "chatHistory":[
      {"role":"user","content":"Que tipo de contrato es?"},
      {"role":"assistant","content":"Es un contrato de servicios profesionales con vigencia anual."}
    ]
  }'
```
Esperado: Query reescrita a "Cuanto dura el contrato de servicios profesionales?"
