# COMPARATIVA: ScriptoriumIA vs VerbadocPro

## Análisis de Capacidades para Documentos Manuscritos y Caligráficos

**Fecha:** Febrero 2026
**Autor:** Análisis técnico automatizado
**Versión:** 1.0

---

## 1. Resumen Ejecutivo

| Aplicación | URL | Especialización |
|------------|-----|-----------------|
| **ScriptoriumIA** | [scriptoriumia.eu](https://scriptoriumia.eu) | Manuscritos históricos, paleografía |
| **VerbadocPro** | [verbadocpro.eu](https://verbadocpro.eu) | Formularios estructurados, documentación administrativa |

**Conclusión principal:** Son aplicaciones **complementarias**, no competidoras. ScriptoriumIA para patrimonio documental histórico, VerbadocPro para gestión documental contemporánea.

---

## 2. Enfoque y Público Objetivo

| Aspecto | ScriptoriumIA | VerbadocPro |
|---------|---------------|-------------|
| **Especialización** | Manuscritos históricos, paleografía | Formularios estructurados, documentación administrativa |
| **Época objetivo** | Medieval - Siglos XV-XIX | Contemporáneo (formularios actuales) |
| **Tipo de escritura** | Caligrafía histórica, humanística, procesal, gótica | Letra manuscrita moderna en casillas |
| **Público** | Archiveros, historiadores, investigadores | Gestores documentales, RRHH, administración |
| **Sector** | Archivos, bibliotecas, universidades | Empresas, administración pública, formación |

---

## 3. Capacidades de Transcripción

### 3.1 ScriptoriumIA - SUPERIOR para manuscritos históricos

| Función | Disponible | Descripción |
|---------|:----------:|-------------|
| HTR (Handwritten Text Recognition) | ✅ | Paleografía especializada con Gemini 2.5 Flash |
| Detección de escrituras históricas | ✅ | Humanística, Procesal, Gótica, Cortesana |
| Abreviaturas históricas | ✅ | Interpreta abreviaturas y ligaduras medievales |
| Idiomas antiguos | ✅ | Latín, castellano antiguo, catalán medieval |
| Marcado de dudas | ✅ | `[ilegible]`, `[?]` para palabras dudosas |
| Transcripción verbatim | ✅ | Respeta ortografía original del documento |
| Edición colaborativa | ✅ | Permite corregir y mejorar transcripciones |

**Tecnología empleada:**
```
Modelo: Gemini 2.5 Flash (Vision)
Prompt: "Actúa como un paleógrafo experto. Transcribe el manuscrito 'verbatim'."
Salida: JSON estructurado con transcripción + análisis visual
```

### 3.2 VerbadocPro - LIMITADO para manuscritos históricos

| Función | Disponible | Descripción |
|---------|:----------:|-------------|
| OCR estructurado | ✅ | Extrae campos de formularios predefinidos |
| Manuscrito en casillas | ✅ | Letra de imprenta/cursiva básica moderna |
| Escrituras históricas | ❌ | No soportado |
| Validación con Excel | ✅ | Cruza datos extraídos con referencia |
| Extracción por coordenadas | ✅ | Localiza campos por posición en el documento |

**Tecnología empleada:**
```
Modelo: Gemini (Vertex AI - Europa)
Enfoque: Schema-based extraction con validación ENUM
Salida: Campos estructurados según plantilla FUNDAE
```

---

## 4. Análisis Visual del Documento

### 4.1 ScriptoriumIA - ANÁLISIS COMPLETO

| Elemento Visual | Detección | Salida |
|-----------------|:---------:|--------|
| Sellos | ✅ | `hasSeals: boolean` |
| Mapas y planos | ✅ | `hasMaps: boolean` |
| Tablas estructuradas | ✅ | `hasTables: boolean` + extracción |
| Iluminaciones y dibujos | ✅ | `hasIlluminations: boolean` |
| Estado físico | ✅ | `physicalCondition: string` (daños, manchas, roturas) |

**Componentes dedicados:**
- `TableExtraction.tsx` - Extracción de datos tabulares
- `TableViewer.tsx` - Visualización de tablas extraídas
- `PDFPreview.tsx` - Vista previa con anotaciones

### 4.2 VerbadocPro - ANÁLISIS PARCIAL

| Elemento Visual | Detección | Salida |
|-----------------|:---------:|--------|
| Códigos de barras | ✅ | Servicio dedicado `barcodeService.ts` |
| Casillas de verificación | ✅ | Detecta checkboxes marcados |
| Segmentación de páginas | ✅ | `segmentationService.ts` |
| Coordenadas de campos | ✅ | Extracción por posición XY |
| Elementos decorativos | ❌ | No soportado |
| Estado físico | ❌ | No analizado |

---

## 5. Análisis Diplomático y Archivístico

### 5.1 ScriptoriumIA - ESPECIALIZADO

ScriptoriumIA incluye un módulo completo de análisis diplomático siguiendo estándares archivísticos:

| Análisis | Descripción | Ejemplo |
|----------|-------------|---------|
| **Tipología documental** | Identifica el tipo de documento | Testamento, Real Cédula, Carta comercial |
| **Serie archivística** | Propone clasificación ISAD(G) | "Reales Cédulas de la Corona de Aragón" |
| **Tipo de letra** | Identifica variante paleográfica | Humanística cursiva, Procesal encadenada |
| **Entidades nombradas** | Extrae personas, lugares, fechas | Personas: ["Juan de Austria"], Lugares: ["Sevilla"] |
| **Eventos históricos** | Detecta hechos mencionados | "Batalla de Lepanto" |
| **Referencias cruzadas** | Encuentra menciones a otros documentos | "según consta en la carta del día 15" |
| **Alertas de calidad** | Señala posibles errores | "Posible fecha errónea en línea 3" |
| **Contexto histórico** | Genera resumen contextual | Descripción del período y circunstancias |

**Ejemplo de salida:**
```json
{
  "typology": "Real Cédula",
  "scriptType": "Humanística cursiva",
  "language": "Castellano siglo XVI",
  "suggestedSeries": "Reales Cédulas de la Corona de Aragón",
  "entities": {
    "people": ["Felipe II", "Duque de Alba"],
    "locations": ["Madrid", "Flandes"],
    "dates": ["1568", "marzo"],
    "events": ["Guerra de los Ochenta Años"]
  },
  "documentReferences": ["según consta en la provisión real de 1567"],
  "qualityAlerts": ["Posible interpolación en línea 12"]
}
```

### 5.2 VerbadocPro - NO APLICA

VerbadocPro no incluye funciones de análisis archivístico. Está enfocado exclusivamente en:
- Validación de datos de formularios
- Extracción de campos estructurados
- Procesamiento de documentación administrativa

---

## 6. Geolocalización y Mapas

### 6.1 ScriptoriumIA - MAPA INTERACTIVO

| Función | Descripción |
|---------|-------------|
| Extracción de topónimos | Detecta nombres de lugares en el texto |
| Geocodificación histórica | Estima coordenadas de lugares antiguos |
| Mapa interactivo | Componente `ManuscriptMap.tsx` con Leaflet |
| Clasificación de lugares | `origin` (lugar de origen) / `reference` (mención) |

**Ejemplo:**
```json
{
  "geodata": [
    { "place": "Sevilla", "type": "origin", "lat": 37.3891, "lng": -5.9845 },
    { "place": "Indias Occidentales", "type": "reference" }
  ]
}
```

### 6.2 VerbadocPro - NO DISPONIBLE

No incluye funcionalidades de geolocalización ni mapas.

---

## 7. Traducción y Accesibilidad Lingüística

### 7.1 ScriptoriumIA - MULTILINGÜE

| Función | Descripción |
|---------|-------------|
| Traducción a español moderno | Convierte textos antiguos a lenguaje actual |
| Normalización ortográfica | Hace el texto legible y accesible |
| Idiomas soportados | Latín → Español, Castellano antiguo → Español moderno |
| Detección de idioma | Identifica automáticamente el idioma del manuscrito |

**Función de traducción:**
```typescript
translateText(text: string, targetLang: string = 'es'): Promise<string>
// "Traduce el siguiente texto de archivo antiguo al español moderno
// legible y accesible"
```

### 7.2 VerbadocPro - NO APLICA

Trabaja exclusivamente con documentos en español moderno. No requiere traducción.

---

## 8. Procesamiento por Lotes (Batch)

| Aspecto | ScriptoriumIA | VerbadocPro |
|---------|:-------------:|:-----------:|
| Batch processing | ⚠️ Básico | ✅ Avanzado |
| Cola de procesamiento | ❌ | ✅ Con reintentos |
| Validación masiva | ❌ | ✅ Cross-check con Excel |
| Reintentos automáticos | ❌ | ✅ Configurable |
| Notificaciones | ❌ | ✅ Por email |

**VerbadocPro** cuenta con:
- `batchProcessingService.ts` - Servicio dedicado de procesamiento masivo
- `process-queue.ts` - API de cola con gestión de errores
- Reintentos automáticos configurables
- Notificaciones de estado por email

---

## 9. Exportación de Datos

### 9.1 ScriptoriumIA

| Formato | Disponible | Contenido |
|---------|:----------:|-----------|
| PDF | ✅ | Imagen + transcripción + análisis |
| XML | ✅ | Metadatos archivísticos (EAD compatible) |
| TXT | ✅ | Solo transcripción |
| JSON | ✅ | Datos estructurados completos |

### 9.2 VerbadocPro

| Formato | Disponible | Contenido |
|---------|:----------:|-----------|
| Excel (.xlsx) | ✅ | Datos extraídos con validación |
| CSV | ✅ | Exportación tabular |
| JSON | ✅ | Datos estructurados |
| PDF consolidado | ✅ | Informe con todos los documentos |

---

## 10. Búsqueda y Recuperación

### 10.1 ScriptoriumIA

| Función | Descripción |
|---------|-------------|
| Búsqueda semántica | Encuentra documentos por significado, no solo palabras |
| Búsqueda por entidades | Filtra por personas, lugares, fechas |
| Detección de duplicados | Identifica documentos similares |
| Búsqueda geográfica | Filtra por ubicación en el mapa |

**Componentes:**
- `SemanticSearch.tsx` - Búsqueda inteligente
- `SearchBar.tsx` - Interfaz de búsqueda

### 10.2 VerbadocPro

| Función | Descripción |
|---------|-------------|
| Búsqueda por referencia | Localiza documentos por código/número |
| Filtros estructurados | Por fecha, tipo, estado |
| Validación cruzada | Compara con Excel de referencia |

---

## 11. Resumen Comparativo: Pros y Contras

### 11.1 ScriptoriumIA

| ✅ VENTAJAS | ❌ LIMITACIONES |
|-------------|-----------------|
| Paleografía experta (HTR especializado) | Sin procesamiento batch robusto |
| Detección de elementos visuales (sellos, mapas, iluminaciones) | Sin validación con Excel de referencia |
| Análisis diplomático completo | Sin detección de códigos de barras |
| Mapa geográfico interactivo | Menor automatización industrial |
| Traducción de lenguas antiguas | Procesamiento documento a documento |
| Tipología y serie archivística | Sin cola de procesamiento |
| Detección de duplicados | |
| Búsqueda semántica | |

### 11.2 VerbadocPro

| ✅ VENTAJAS | ❌ LIMITACIONES |
|-------------|-----------------|
| Procesamiento batch masivo | Sin paleografía histórica |
| Validación cruzada con Excel | Sin análisis diplomático |
| Detección de códigos de barras | Sin detección de sellos/mapas/iluminaciones |
| Extracción por coordenadas | Sin traducción de lenguas antiguas |
| Agente IA con aprendizaje continuo | Sin geolocalización |
| Cola con reintentos automáticos | Solo formularios estructurados |
| Segmentación inteligente de páginas | Sin búsqueda semántica |
| Notificaciones por email | |

---

## 12. Recomendación de Uso por Caso

| Caso de Uso | Aplicación Recomendada |
|-------------|:----------------------:|
| Archivo histórico, documentos medievales | **ScriptoriumIA** |
| Formularios FUNDAE, cuestionarios de calidad | **VerbadocPro** |
| Manuscritos con sellos, mapas e iluminaciones | **ScriptoriumIA** |
| Validación masiva de datos con Excel | **VerbadocPro** |
| Investigación histórica y genealógica | **ScriptoriumIA** |
| Digitalización de formularios administrativos | **VerbadocPro** |
| Traducción de latín o castellano antiguo | **ScriptoriumIA** |
| Extracción de campos estructurados con schema | **VerbadocPro** |
| Catalogación archivística (ISAD-G) | **ScriptoriumIA** |
| Procesamiento de documentación FUNDAE | **VerbadocPro** |
| Detección de duplicados en archivo | **ScriptoriumIA** |
| Lectura de códigos de barras | **VerbadocPro** |

---

## 13. Especificaciones Técnicas

### 13.1 ScriptoriumIA

| Componente | Tecnología |
|------------|------------|
| Frontend | React + TypeScript + Vite |
| IA | Google Gemini 2.5 Flash (Vision) |
| Mapas | Leaflet.js |
| PDF | pdfjs-dist |
| Estilos | Tailwind CSS |
| Deploy | Vercel |

**Servicios principales:**
- `geminiService.ts` - Transcripción y análisis con IA

### 13.2 VerbadocPro

| Componente | Tecnología |
|------------|------------|
| Frontend | React + TypeScript + Vite |
| IA | Google Gemini (Vertex AI - Europa) |
| Base de datos | Vercel Postgres |
| Storage | Vercel Blob |
| PDF | pdfjs-dist + canvas rendering |
| Estilos | Tailwind CSS |
| Deploy | Vercel |

**Servicios principales:**
- `geminiService.ts` - Extracción estructurada
- `batchProcessingService.ts` - Procesamiento masivo
- `barcodeService.ts` - Lectura de códigos
- `segmentationService.ts` - División de páginas
- `aiAgentService.ts` - Agente inteligente
- `learningService.ts` - Aprendizaje continuo

---

## 14. Conclusión Final

**ScriptoriumIA** y **VerbadocPro** son herramientas complementarias diseñadas para necesidades distintas:

### ScriptoriumIA
> La herramienta especializada para **paleografía y archivística**, ideal para manuscritos históricos, con capacidades únicas de transcripción de escrituras antiguas, análisis diplomático, geolocalización y traducción de lenguas históricas.

### VerbadocPro
> La herramienta de **producción industrial** para formularios y documentos estructurados, con procesamiento masivo, validación automatizada contra Excel y aprendizaje continuo para mejorar la extracción.

---

**Recomendación:** Para organizaciones que manejan tanto patrimonio documental histórico como documentación administrativa contemporánea, **ambas herramientas son necesarias** y se complementan perfectamente.

---

*Documento generado automáticamente - Febrero 2026*
