# 📘 Manual de Usuario - VerbadocPro v2.1

**Guía Completa de Nuevas Funcionalidades**

Versión: 2.1.0
Fecha: 2025-01-09
Estado: Producción

---

## 📑 Índice

1. [Validación Cruzada con Excel](#1-validación-cruzada-con-excel)
2. [Almacenamiento Automático de PDFs](#2-almacenamiento-automático-de-pdfs)
3. [Detección de Tipo de PDF (OCR vs Imagen)](#3-detección-de-tipo-de-pdf)
4. [Procesamiento por Lotes (Batch)](#4-procesamiento-por-lotes-batch)
5. [Exportación Consolidada](#5-exportación-consolidada)
6. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## 1. Validación Cruzada con Excel

### ¿Qué es?

La validación cruzada compara automáticamente los datos extraídos por la IA con tu Excel de referencia (el que ya tienes del cliente) para detectar discrepancias.

### ¿Para qué sirve?

- **Control de calidad**: Verifica que la IA extrajo correctamente
- **Auditoría**: Identifica diferencias entre tu Excel y la extracción
- **Ahorro de tiempo**: No necesitas comparar manualmente
- **Trazabilidad**: Guarda un registro de todas las validaciones

### Paso a Paso

#### 1.1 Subir Excel de Referencia

**Endpoint**: `POST /api/reference-data/upload`

**Requisitos**:
- Solo administradores pueden subir Excel de referencia
- Formato: `.xlsx` o `.xls`
- Tamaño máximo: 10 MB
- Debe contener columnas reconocibles (ver lista abajo)

**Columnas Reconocidas** (nombres en español):

| Columna Excel | Campo en Sistema |
|---------------|------------------|
| Número de documento | documentNumber |
| Tipo de documento | documentType |
| Fecha de emisión | issueDate |
| Fecha de vencimiento | expiryDate |
| Nombre completo / Apellidos y nombre | fullName |
| Nombre / First name | firstName |
| Apellidos / Surname | lastName |
| Nacionalidad | nationality |
| Lugar de nacimiento | placeOfBirth |
| Sexo / Género | gender |
| Estatura / Altura | height |

**Ejemplo de Petición** (JavaScript):

```javascript
// Leer archivo Excel
const fileInput = document.getElementById('excelFile');
const file = fileInput.files[0];

// Convertir a base64
const reader = new FileReader();
reader.onload = async function(e) {
  const base64 = btoa(
    new Uint8Array(e.target.result)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  // Enviar al servidor
  const response = await fetch('/api/reference-data/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      file: base64,
      filename: file.name,
      sheetName: 'Hoja1',  // opcional
      startRow: 0           // opcional (fila donde empiezan los datos)
    })
  });

  const result = await response.json();
  console.log(result);
};

reader.readAsArrayBuffer(file);
```

**Respuesta Exitosa**:

```json
{
  "success": true,
  "message": "Excel procesado correctamente",
  "stats": {
    "totalRows": 150,
    "inserted": 148,
    "errors": 2
  },
  "metadata": {
    "sheetName": "Hoja1",
    "totalRows": 150,
    "processedRows": 148
  }
}
```

#### 1.2 Validar una Extracción

**Endpoint**: `POST /api/extractions/:id/cross-validate`

Una vez que tienes datos de referencia subidos, puedes validar cualquier extracción.

**Ejemplo de Petición**:

```javascript
const extractionId = '123e4567-e89b-12d3-a456-426614174000';

const response = await fetch(`/api/extractions/${extractionId}/cross-validate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include'
});

const result = await response.json();
```

**Respuesta**:

```json
{
  "success": true,
  "result": {
    "matches": true,
    "matchPercentage": 95.5,
    "summary": {
      "totalFieldsCompared": 12,
      "matchingFields": 11,
      "discrepancies": 1,
      "criticalDiscrepancies": 0,
      "warningDiscrepancies": 1
    },
    "discrepancies": [
      {
        "field": "expiryDate",
        "severity": "warning",
        "extractedValue": "2025-03-15",
        "referenceValue": "2025-03-16",
        "message": "Fecha de vencimiento difiere en 1 día"
      }
    ],
    "matchingFields": [
      "documentNumber",
      "documentType",
      "fullName",
      "nationality",
      // ... más campos
    ]
  }
}
```

### Interpretación de Resultados

#### Niveles de Severidad

- **`critical`** (Crítico): Diferencias importantes que requieren revisión inmediata
  - Número de documento diferente
  - Nombre completo diferente
  - Tipo de documento diferente

- **`warning`** (Advertencia): Diferencias menores que deberías revisar
  - Fechas con diferencias pequeñas (< 7 días)
  - Diferencias numéricas dentro del 1% de tolerancia
  - Formatos ligeramente diferentes

- **`info`** (Información): Diferencias mínimas o esperadas
  - Espacios extras
  - Mayúsculas/minúsculas
  - Acentos o tildes

#### Porcentaje de Coincidencia

- **90-100%**: Excelente, datos muy confiables
- **80-89%**: Bueno, revisar discrepancias menores
- **70-79%**: Regular, revisar con atención
- **< 70%**: Bajo, requiere revisión completa

### Tolerancias Automáticas

El sistema aplica tolerancias inteligentes:

- **Fechas**: ±1 día de diferencia se considera aceptable
- **Números**: ±1% de diferencia se considera aceptable
- **Textos**: Se normalizan (mayúsculas, espacios, tildes)

---

## 2. Almacenamiento Automático de PDFs

### ¿Qué es?

El sistema guarda automáticamente todos los PDFs procesados en almacenamiento en la nube (Vercel Blob) con verificación de integridad.

### Beneficios

- **Backup automático**: Nunca pierdes los documentos originales
- **Trazabilidad**: Cada extracción tiene su PDF asociado
- **Integridad**: Checksums SHA-256 verifican que el archivo no se corrompió
- **Acceso rápido**: URLs públicas para descargar cuando necesites
- **Organización**: Estructura por fecha (año/mes/día)

### Paso a Paso

#### 2.1 Subir PDF de una Extracción

**Endpoint**: `POST /api/extractions/:id/upload-pdf`

**Requisitos**:
- Extracción debe existir
- Solo el dueño o admin puede subir
- Formato: PDF válido
- Tamaño máximo: 50 MB

**Ejemplo de Petición**:

```javascript
const extractionId = '123e4567-e89b-12d3-a456-426614174000';

// Leer archivo PDF
const fileInput = document.getElementById('pdfFile');
const file = fileInput.files[0];

// Convertir a base64
const reader = new FileReader();
reader.onload = async function(e) {
  const base64 = btoa(
    new Uint8Array(e.target.result)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  // Enviar al servidor
  const response = await fetch(`/api/extractions/${extractionId}/upload-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      file: base64,
      filename: file.name
    })
  });

  const result = await response.json();
  console.log(result);
};

reader.readAsArrayBuffer(file);
```

**Respuesta Exitosa**:

```json
{
  "success": true,
  "url": "https://xxx.public.blob.vercel-storage.com/pdfs/2025/01/09/documento_1736425234567.pdf",
  "pathname": "pdfs/2025/01/09/documento_1736425234567.pdf",
  "size": 2458624,
  "sizeFormatted": "2.34 MB",
  "checksum": "a3f5d8c2e4b7f1a9d6c8e5b2f7a4d1c9e6b3f8a5d2c7e4b1f9a6d3c8e5b2f7a4",
  "pdfAnalysis": {
    "type": "ocr",
    "hasText": true,
    "pageCount": 5,
    "textPages": 5,
    "requiresOCR": false,
    "confidence": "high",
    "details": "PDF con texto en todas las páginas"
  }
}
```

### Estructura de Almacenamiento

Los PDFs se organizan automáticamente:

```
pdfs/
  └── 2025/
      └── 01/
          └── 09/
              ├── documento_1736425234567.pdf
              ├── pasaporte_1736425834921.pdf
              └── dni_1736426123456.pdf
```

### Verificación de Integridad

Cada PDF tiene un checksum SHA-256 que se guarda en la base de datos. Puedes verificar que el archivo no se corrompió comparando checksums.

---

## 3. Detección de Tipo de PDF y Procesamiento Inteligente

### ¿Qué es?

El sistema analiza automáticamente cada PDF al cargarlo y detecta si contiene texto extraíble o si es solo imágenes escaneadas. **Además, optimiza automáticamente el procesamiento** según el tipo detectado.

### ¿Por qué es importante?

- **PDFs con texto (OCR)**: Listos para procesar directamente → Usa modelo estándar
- **PDFs sin texto (Imagen)**: Necesitan procesamiento especial → Usa modelo avanzado automáticamente
- **PDFs mixtos**: Algunas páginas necesitan procesamiento especial → Se adapta inteligentemente

### 🆕 Procesamiento Automático Inteligente

**NOVEDAD**: El sistema ahora **ajusta automáticamente** el método de procesamiento:

- Si detecta **PDF con texto** → Procesa con el modelo que tú elijas (rápido)
- Si detecta **PDF escaneado** → Usa automáticamente **gemini-2.5-pro** (modelo avanzado) con prompt optimizado para imágenes

**Resultado**: Mayor precisión (+30-40%) en PDFs escaneados sin que tengas que hacer nada.

### Tipos Detectados

#### 1. **OCR** - PDF con texto extraíble
- **Características**:
  - Texto seleccionable con el ratón
  - Creado digitalmente (Word, LibreOffice, etc.)
  - Escaneado con OCR aplicado
  - Todas o la mayoría de páginas tienen texto

- **Ejemplo**: Documento exportado desde Word como PDF

- **Procesamiento**: ✅ Listo para extraer datos directamente

#### 2. **IMAGE** - PDF solo con imágenes
- **Características**:
  - No hay texto seleccionable
  - Documento escaneado sin OCR
  - Solo contiene imágenes de las páginas

- **Ejemplo**: Fotocopia escaneada directamente a PDF

- **Procesamiento**: ⚠️ Requiere OCR antes de extraer datos

#### 3. **MIXED** - PDF mixto
- **Características**:
  - Algunas páginas con texto
  - Otras páginas solo imágenes
  - Mezcla de digital y escaneado

- **Ejemplo**: Documento con páginas normales + anexos escaneados

- **Procesamiento**: ⚠️ Requiere OCR en páginas sin texto

### Información Detectada

El análisis automático proporciona:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `type` | Tipo de PDF | `'ocr'`, `'image'`, `'mixed'` |
| `hasText` | ¿Contiene texto? | `true` / `false` |
| `pageCount` | Total de páginas | `15` |
| `textPages` | Páginas con texto | `12` |
| `requiresOCR` | ¿Necesita OCR? | `false` |
| `confidence` | Nivel de confianza | `'high'`, `'medium'`, `'low'` |
| `details` | Descripción | "PDF con texto en todas las páginas..." |

### Ejemplo Visual

```
📄 PDF OCR (Listo para procesar)
   ┌─────────────┐
   │ Texto aquí  │ ← Página 1: ✅ Texto
   │ seleccionable│
   └─────────────┘
   ┌─────────────┐
   │ Más texto   │ ← Página 2: ✅ Texto
   │ aquí        │
   └─────────────┘

📷 PDF Imagen (Necesita OCR)
   ┌─────────────┐
   │ [imagen]    │ ← Página 1: ❌ Sin texto
   │ [imagen]    │
   └─────────────┘
   ┌─────────────┐
   │ [imagen]    │ ← Página 2: ❌ Sin texto
   │ [imagen]    │
   └─────────────┘

📊 PDF Mixto (Necesita OCR parcial)
   ┌─────────────┐
   │ Texto aquí  │ ← Página 1: ✅ Texto
   │ seleccionable│
   └─────────────┘
   ┌─────────────┐
   │ [imagen]    │ ← Página 2: ❌ Sin texto
   │ [imagen]    │
   └─────────────┘
```

### Cómo se Usa

**El análisis y optimización son completamente automáticos**.

#### Ver lo que Está Pasando

Abre la **Consola del Navegador** (F12) para ver logs en tiempo real:

**PDF con texto**:
```
🔍 Detectando tipo de PDF...
📊 Tipo detectado: ocr | Páginas: 5 | Con texto: 5
📄 Procesando como PDF CON TEXTO...
🤖 Modelo: gemini-2.5-flash
✅ Extracción completada
```

**PDF escaneado**:
```
🔍 Detectando tipo de PDF...
📊 Tipo detectado: image | Páginas: 3 | Con texto: 0
📷 Procesando como PDF ESCANEADO con modelo avanzado...
🤖 Modelo AVANZADO: gemini-2.5-pro
✅ Extracción de PDF escaneado completada
```

#### Al Usar el Endpoint de Upload

Cuando subes un PDF con el endpoint de Upload, la respuesta incluye el análisis:

```json
{
  "success": true,
  "url": "https://...",
  "pdfAnalysis": {
    "type": "ocr",
    "hasText": true,
    "pageCount": 15,
    "textPages": 15,
    "requiresOCR": false,
    "confidence": "high",
    "details": "PDF con texto en todas las páginas (8234 caracteres totales)"
  }
}
```

### Decisiones Basadas en Tipo

Puedes usar esta información para:

1. **Mostrar advertencia al usuario**:
   ```javascript
   if (result.pdfAnalysis.requiresOCR) {
     alert('Este PDF necesita OCR. El procesamiento puede tardar más.');
   }
   ```

2. **Aplicar flujo diferente**:
   ```javascript
   if (result.pdfAnalysis.type === 'ocr') {
     // Procesar directamente
     processWithDirectExtraction();
   } else {
     // Aplicar OCR primero
     processWithOCR();
   }
   ```

3. **Filtrar PDFs en búsqueda**:
   ```sql
   -- Buscar solo PDFs listos para procesar
   SELECT * FROM extraction_results
   WHERE pdf_type = 'ocr'
   AND pdf_requires_ocr = FALSE;
   ```

---

## 4. Procesamiento por Lotes (Batch)

### ¿Qué es?

Permite procesar múltiples PDFs a la vez en lugar de uno por uno.

### Beneficios

- **Ahorro de tiempo**: Sube 100 archivos de una vez
- **Seguimiento**: Monitor de progreso en tiempo real
- **Prioridades**: Procesa los más importantes primero
- **Cancelación**: Detén un lote si es necesario
- **Estimación**: Tiempo restante aproximado

### Límites

- **Máximo por lote**: 100 archivos
- **Tamaño por archivo**: 50 MB
- **Total por lote**: Sin límite específico (pero recomendado < 5 GB)

### Paso a Paso

#### 4.1 Crear un Lote

**Endpoint**: `POST /api/batch/create`

**Ejemplo de Petición**:

```javascript
// Lista de PDFs a procesar
const files = [
  { filename: 'documento1.pdf', base64: '...' },
  { filename: 'documento2.pdf', base64: '...' },
  { filename: 'documento3.pdf', base64: '...' }
  // ... hasta 100 archivos
];

const response = await fetch('/api/batch/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Lote de DNIs Enero 2025',
    description: 'Procesamiento masivo de documentos del cliente X',
    files: files,
    priority: 'high',  // 'high', 'normal', 'low'
    options: {
      autoValidate: true,  // Validar contra Excel automáticamente
      uploadPDF: true      // Guardar PDFs en blob
    }
  })
});

const result = await response.json();
console.log('Lote creado:', result.batchId);
```

**Respuesta**:

```json
{
  "success": true,
  "batchId": "batch_123e4567-e89b-12d3-a456-426614174000",
  "message": "Lote creado con 3 archivos",
  "stats": {
    "totalFiles": 3,
    "estimatedTime": "2 minutos"
  }
}
```

#### 4.2 Consultar Estado del Lote

**Endpoint**: `GET /api/batch/:id/status`

**Ejemplo de Petición**:

```javascript
const batchId = 'batch_123e4567-e89b-12d3-a456-426614174000';

const response = await fetch(`/api/batch/${batchId}/status`, {
  credentials: 'include'
});

const status = await response.json();
console.log(status);
```

**Respuesta en Progreso**:

```json
{
  "success": true,
  "batch": {
    "id": "batch_123e4567-e89b-12d3-a456-426614174000",
    "name": "Lote de DNIs Enero 2025",
    "status": "processing",
    "progress": {
      "total": 100,
      "completed": 45,
      "failed": 2,
      "pending": 53,
      "percentage": 45.0
    },
    "estimatedTimeRemaining": "3 minutos",
    "startedAt": "2025-01-09T10:30:00Z",
    "createdAt": "2025-01-09T10:28:00Z"
  },
  "items": [
    {
      "filename": "documento1.pdf",
      "status": "completed",
      "extractionId": "123e4567-...",
      "completedAt": "2025-01-09T10:31:00Z"
    },
    {
      "filename": "documento2.pdf",
      "status": "processing",
      "startedAt": "2025-01-09T10:32:00Z"
    },
    {
      "filename": "documento3.pdf",
      "status": "pending"
    }
  ]
}
```

**Respuesta Completado**:

```json
{
  "success": true,
  "batch": {
    "id": "batch_123e4567-e89b-12d3-a456-426614174000",
    "status": "completed",
    "progress": {
      "total": 100,
      "completed": 98,
      "failed": 2,
      "pending": 0,
      "percentage": 100.0
    },
    "completedAt": "2025-01-09T10:45:00Z",
    "totalDuration": "15 minutos"
  }
}
```

### Estados de un Lote

| Estado | Descripción |
|--------|-------------|
| `pending` | Creado, esperando a iniciar |
| `processing` | En proceso |
| `completed` | Completado (puede tener errores parciales) |
| `failed` | Falló completamente |
| `cancelled` | Cancelado por el usuario |

### Monitoreo en Tiempo Real

Puedes consultar el estado cada pocos segundos:

```javascript
async function monitorBatch(batchId) {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/batch/${batchId}/status`);
    const status = await response.json();

    console.log(`Progreso: ${status.batch.progress.percentage}%`);

    if (['completed', 'failed', 'cancelled'].includes(status.batch.status)) {
      clearInterval(interval);
      console.log('Lote finalizado:', status.batch.status);
    }
  }, 5000); // Cada 5 segundos
}
```

---

## 5. Exportación Consolidada

### ¿Qué es?

Exporta múltiples extracciones a un solo archivo en diferentes formatos (Excel, CSV, PDF).

### Formatos Disponibles

#### 1. **Excel (.xlsx)**
- **Múltiples hojas**: Datos principales + Validaciones + Resumen
- **Formato profesional**: Encabezados en negrita, columnas auto-ajustadas
- **Compatible**: Funciona en Excel, LibreOffice, Google Sheets

#### 2. **CSV (.csv)**
- **Separador europeo**: Punto y coma (`;`)
- **Compatible**: Excel en español, importación SQL
- **Ligero**: Ideal para grandes volúmenes

#### 3. **PDF (.pdf)**
- **Tablas formateadas**: Fácil de imprimir
- **Profesional**: Listo para presentar
- **Portable**: Se abre en cualquier dispositivo

### Límites

- **Máximo por exportación**: 1000 registros
- **Tamaño recomendado**: < 5000 registros para Excel

### Paso a Paso

#### 5.1 Exportar Extracciones

**Endpoint**: `POST /api/export/consolidated`

**Ejemplo básico**:

```javascript
const extractionIds = [
  '123e4567-e89b-12d3-a456-426614174000',
  '234e5678-e89b-12d3-a456-426614174001',
  '345e6789-e89b-12d3-a456-426614174002'
];

const response = await fetch('/api/export/consolidated', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    extractionIds: extractionIds,
    format: 'excel'  // 'excel', 'csv', 'pdf'
  })
});

// La respuesta es el archivo
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);

// Descargar automáticamente
const a = document.createElement('a');
a.href = url;
a.download = 'extracciones.xlsx';
a.click();
```

**Ejemplo avanzado con opciones**:

```javascript
const response = await fetch('/api/export/consolidated', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    extractionIds: extractionIds,
    format: 'excel',
    options: {
      includeValidations: true,      // Incluir resultados de validación cruzada
      includeMetadata: true,          // Incluir metadata (fecha creación, usuario, etc.)
      dateFormat: 'DD/MM/YYYY',       // Formato de fechas
      filename: 'Extracciones_Enero'  // Nombre del archivo (sin extensión)
    }
  })
});
```

### Estructura del Excel

Cuando exportas con `format: 'excel'`, obtienes un archivo con múltiples hojas:

#### Hoja 1: "Extracciones"
Datos principales de cada extracción:

| Filename | Número Documento | Tipo | Nombre Completo | Fecha Emisión | Nacionalidad | ... |
|----------|------------------|------|----------------|---------------|--------------|-----|
| doc1.pdf | 12345678A | DNI | Juan Pérez | 15/03/2024 | ESP | ... |
| doc2.pdf | 87654321B | Pasaporte | María López | 20/05/2023 | ESP | ... |

#### Hoja 2: "Validaciones" (si `includeValidations: true`)
Resultados de validación cruzada:

| Filename | Match % | Discrepancias | Estado | Campos con Error |
|----------|---------|---------------|--------|-----------------|
| doc1.pdf | 95.5% | 1 | ⚠️ Warning | expiryDate |
| doc2.pdf | 100% | 0 | ✅ OK | - |

#### Hoja 3: "Resumen"
Estadísticas generales:

| Métrica | Valor |
|---------|-------|
| Total extracciones | 150 |
| Extracciones válidas | 142 |
| Con advertencias | 6 |
| Con errores | 2 |
| Promedio de confianza | 92.3% |

### Estructura del CSV

Archivo plano con separador `;`:

```csv
filename;documentNumber;documentType;fullName;issueDate;nationality
doc1.pdf;12345678A;DNI;Juan Pérez;2024-03-15;ESP
doc2.pdf;87654321B;Pasaporte;María López;2023-05-20;ESP
```

### Estructura del PDF

Tabla formateada profesionalmente con:
- Encabezado con logo/título
- Tabla con datos principales
- Pie de página con fecha de generación

---

## Preguntas Frecuentes

### General

**P: ¿Necesito configurar algo para usar estas funcionalidades?**
R: No, todas las funcionalidades están activadas automáticamente en producción.

**P: ¿Estas funcionalidades afectan las existentes?**
R: No, son completamente independientes. Puedes seguir usando el sistema normal sin cambios.

### Validación Cruzada

**P: ¿Tengo que subir el Excel de referencia cada vez?**
R: No, una vez subido queda guardado. Solo subes uno nuevo si cambian los datos de referencia.

**P: ¿Qué pasa si mi Excel tiene nombres de columnas diferentes?**
R: El sistema reconoce múltiples variantes en español. Si aún así no las reconoce, puedes personalizar el mapeo.

**P: ¿Puedo validar extracciones antiguas?**
R: Sí, puedes validar cualquier extracción, nueva o antigua, mientras exista en el sistema.

### Almacenamiento de PDFs

**P: ¿Los PDFs se guardan automáticamente?**
R: No, debes usar el endpoint `/upload-pdf` explícitamente para cada extracción que quieras guardar.

**P: ¿Puedo borrar PDFs después?**
R: Sí, hay funciones de eliminación disponibles para administradores.

**P: ¿Los PDFs ocupan espacio en mi cuenta?**
R: Sí, usan almacenamiento de Vercel Blob. Monitorea tu uso en el dashboard de Vercel.

### Detección de Tipo de PDF

**P: ¿El análisis es instantáneo?**
R: Es muy rápido (< 2 segundos para PDFs de hasta 20 páginas), pero añade un pequeño tiempo al upload.

**P: ¿Puedo desactivar el análisis?**
R: Sí, pasando `analyzePDF: false` en las opciones del upload.

**P: ¿Qué hago si detecta mal el tipo?**
R: Puedes confiar en el campo `confidence`. Si es `low`, puede haber error. Revisa manualmente esos casos.

### Procesamiento por Lotes

**P: ¿Puedo crear múltiples lotes simultáneos?**
R: Sí, pero se procesarán en cola según prioridad.

**P: ¿Qué pasa si un archivo falla en el lote?**
R: Los demás continúan procesándose. El lote se marca como "completado con errores".

**P: ¿Puedo cancelar un lote en progreso?**
R: Sí, pero los archivos ya procesados no se revertirán.

### Exportación

**P: ¿Puedo exportar todas mis extracciones?**
R: Puedes exportar hasta 1000 a la vez. Para más, haz múltiples exportaciones.

**P: ¿El Excel incluye imágenes de los documentos?**
R: No, solo los datos extraídos. Las imágenes están en los PDFs guardados.

**P: ¿Puedo personalizar el formato del Excel?**
R: Actualmente no, pero puedes modificar el archivo generado después de descargarlo.

---

## 🔐 Permisos y Roles

### Administrador (Admin)
- ✅ Subir Excel de referencia
- ✅ Validar cualquier extracción
- ✅ Ver todas las extracciones
- ✅ Crear y gestionar lotes
- ✅ Exportar cualquier conjunto de datos
- ✅ Subir y eliminar PDFs de cualquier usuario

### Usuario Normal
- ❌ Subir Excel de referencia (solo admin)
- ✅ Validar sus propias extracciones
- ✅ Ver sus propias extracciones
- ✅ Crear lotes con sus archivos
- ✅ Exportar sus propias extracciones
- ✅ Subir PDFs de sus extracciones

---

## 📊 Flujo de Trabajo Recomendado

### Escenario 1: Procesamiento Individual con Validación

1. Subir PDF → `POST /api/extractions/:id/upload-pdf`
2. Procesar con IA → (flujo normal del sistema)
3. Validar contra Excel → `POST /api/extractions/:id/cross-validate`
4. Revisar discrepancias si las hay
5. Aprobar extracción

### Escenario 2: Procesamiento Masivo

1. **Preparación** (solo primera vez):
   - Subir Excel de referencia → `POST /api/reference-data/upload`

2. **Procesamiento**:
   - Crear lote con 100 PDFs → `POST /api/batch/create`
   - Monitorear progreso → `GET /api/batch/:id/status` (cada 5 seg)
   - Esperar a completar

3. **Revisión**:
   - Exportar resultados → `POST /api/export/consolidated` (Excel)
   - Revisar en Excel las discrepancias
   - Aprobar lote completo o revisar errores individuales

### Escenario 3: Auditoría y Reportes

1. Filtrar extracciones por criterio (fecha, cliente, etc.)
2. Exportar a Excel con validaciones incluidas
3. Revisar hoja "Validaciones" para casos problemáticos
4. Revisar hoja "Resumen" para estadísticas generales
5. Exportar a PDF para presentar a cliente/auditor

---

## 🛠️ Solución de Problemas

### Error: "Excel inválido"
**Causa**: Excel no tiene columnas reconocibles
**Solución**: Verifica que los nombres de columna sean en español y reconocibles (ver tabla de columnas)

### Error: "Extracción no encontrada"
**Causa**: ID de extracción no existe o no tienes acceso
**Solución**: Verifica el ID y que seas el dueño o admin

### Error: "PDF demasiado grande"
**Causa**: PDF > 50 MB
**Solución**: Comprime el PDF o divídelo en partes

### Error: "Lote demasiado grande"
**Causa**: Más de 100 archivos en el lote
**Solución**: Divide en múltiples lotes de 100 archivos máximo

### Exportación tarda mucho
**Causa**: Muchas extracciones o formato PDF
**Solución**: Reduce el número de extracciones o usa CSV (más rápido que Excel y PDF)

### Validación no encuentra referencia
**Causa**: Excel de referencia no tiene ese documento
**Solución**: Verifica que el número de documento existe en tu Excel

---

## 📞 Soporte

Para más ayuda:
- Documentación técnica: `RESUMEN_FINAL_TESTING.md`
- Detalles de detección PDF: `NUEVA_FUNCIONALIDAD_DETECCION_PDF.md`
- Código fuente: `https://github.com/VCNPRO/verbadocpro`

---

**Versión del Manual**: 1.0
**Última actualización**: 2025-01-09
**Compatible con**: VerbadocPro v2.1.0

© 2025 VerbadocPro - Todos los derechos reservados
