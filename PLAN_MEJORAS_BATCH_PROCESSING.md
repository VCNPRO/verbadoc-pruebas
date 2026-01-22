# 📋 Plan de Mejoras: Procesamiento por Lotes y Exportación Avanzada

## 🎯 Objetivos

1. **Carga de carpetas** completas con múltiples archivos
2. **Procesamiento batch** automatizado
3. **Exportación flexible**: individual o consolidada
4. **Integración con sistemas locales** de clientes
5. **Interfaz mejorada** para gestión de resultados

---

## 1️⃣ PROCESAMIENTO POR LOTES (Batch Processing)

### Funcionalidades requeridas

#### A. Carga de archivos
- ✅ **Drag & Drop de carpetas** completas
- ✅ **Selección múltiple** de archivos
- ✅ **Agrupación por carpetas** (mantener estructura)
- ✅ **Pre-visualización** antes de procesar
- ✅ **Filtrado** por tipo de archivo (PDF, imágenes, etc.)

#### B. Procesamiento
```
┌─────────────────────────────────────────────┐
│  OPCIONES DE PROCESAMIENTO                 │
├─────────────────────────────────────────────┤
│  1. PLANTILLA ÚNICA para todos             │
│     → Mismo esquema JSON para toda carpeta │
│                                             │
│  2. PLANTILLA POR TIPO                     │
│     → Facturas: plantilla A                │
│     → Albaranes: plantilla B               │
│     → DNI: plantilla C                     │
│                                             │
│  3. DETECCIÓN AUTOMÁTICA                   │
│     → IA detecta tipo y aplica plantilla   │
└─────────────────────────────────────────────┘
```

#### C. Estado y monitoreo
```javascript
{
  "batch_id": "batch_20260107_153045",
  "total_files": 50,
  "processed": 35,
  "pending": 10,
  "failed": 5,
  "status": "processing",
  "progress": 70,
  "estimated_time_remaining": "2 min",
  "files": [
    {
      "name": "factura_001.pdf",
      "status": "completed",
      "result": { ... }
    },
    {
      "name": "factura_002.pdf",
      "status": "processing",
      "progress": 45
    },
    {
      "name": "factura_003.pdf",
      "status": "failed",
      "error": "Código QR no encontrado"
    }
  ]
}
```

---

## 2️⃣ OPCIONES DE EXPORTACIÓN

### A. Formatos disponibles

| Formato | Descripción | Uso recomendado |
|---------|-------------|------------------|
| **CSV** | Tabular, compatible con Excel | Análisis de datos, importación ERP |
| **XML** | Estructurado, estándar empresarial | Sistemas legacy, SAP, facturación electrónica |
| **JSON** | Flexible, para APIs | Integración web, microservicios |
| **Excel (.xlsx)** | Con formato, múltiples hojas | Reportes ejecutivos, análisis |
| **PDF** | Imprimible, visual | Archivo documental |
| **ZIP** | Múltiples archivos comprimidos | Entrega en bloque |

### B. Modos de exportación

#### OPCIÓN 1: Archivo por documento (Individual)
```
📁 resultados_batch_20260107/
  ├── factura_001.xml
  ├── factura_001.json
  ├── factura_002.xml
  ├── factura_002.json
  └── ...
```

**Ventajas:**
- ✅ Fácil identificación documento-resultado
- ✅ Procesamiento individual posterior
- ✅ Reintentar solo los fallidos

**Casos de uso:**
- Sistemas que procesan archivos uno a uno
- Necesidad de auditoría individual
- Integración con OCR/validadores

#### OPCIÓN 2: Archivo consolidado (Todos en uno)
```csv
# resultados_consolidado.csv
archivo,numero_factura,cif,total,fecha,estado
factura_001.pdf,F-2024-001,B12345678,1250.50,2024-01-15,procesado
factura_002.pdf,F-2024-002,B12345678,890.00,2024-01-16,procesado
factura_003.pdf,F-2024-003,A87654321,2100.75,2024-01-17,procesado
```

**Ventajas:**
- ✅ Importación masiva a bases de datos
- ✅ Análisis global en Excel/Power BI
- ✅ Menor número de archivos a gestionar

**Casos de uso:**
- Importación a ERP (SAP, Navision)
- Análisis estadístico
- Reporting

#### OPCIÓN 3: Mixta (Lo mejor de ambos)
```
📁 resultados_batch_20260107/
  ├── consolidado.csv         ← TODOS en uno
  ├── consolidado.xml
  ├── individual/             ← Cada uno por separado
  │   ├── factura_001.json
  │   ├── factura_002.json
  │   └── factura_003.json
  └── metadata.json           ← Info del lote
```

### C. Configuración de exportación (UI)

```
┌──────────────────────────────────────────────────┐
│  EXPORTAR RESULTADOS                             │
├──────────────────────────────────────────────────┤
│                                                  │
│  Selección de archivos:                         │
│  ☑ Seleccionar todos (50 archivos)              │
│  ☐ factura_001.pdf  ☐ factura_002.pdf  ...     │
│                                                  │
│  Formato de salida:                             │
│  ○ Individual (1 archivo por documento)         │
│  ● Consolidado (todos en 1 archivo)             │
│  ○ Mixto (ambos)                                │
│                                                  │
│  Tipos de archivo:                              │
│  ☑ CSV   ☑ Excel   ☑ JSON   ☐ XML   ☐ PDF      │
│                                                  │
│  Opciones CSV/Excel:                            │
│  Orientación: ● Horizontal ○ Vertical           │
│  Incluir: ☑ Metadatos ☑ Fecha procesamiento    │
│                                                  │
│  [ Previsualizar ]  [ Descargar ]               │
└──────────────────────────────────────────────────┘
```

---

## 3️⃣ INTEGRACIÓN CON SISTEMAS LOCALES

### A. Arquitecturas de integración

#### OPCIÓN 1: API REST (Recomendada) ⭐
```javascript
// Cliente envía documentos
POST https://api.verbadocpro.eu/v1/batch
Content-Type: multipart/form-data
Authorization: Bearer {API_KEY}

{
  "batch_name": "facturas_enero_2024",
  "template_id": "factura_es",
  "files": [ ... ],
  "webhook_url": "https://cliente.com/api/results",
  "export_format": "json"
}

// VerbadocPro procesa y devuelve
Response:
{
  "batch_id": "batch_xyz",
  "status": "queued",
  "estimated_time": 120
}

// Al terminar, webhook a cliente
POST https://cliente.com/api/results
{
  "batch_id": "batch_xyz",
  "status": "completed",
  "results_url": "https://api.verbadocpro.eu/v1/batch/batch_xyz/download",
  "files_processed": 50,
  "files_failed": 0
}
```

**Ventajas:**
- ✅ Integración moderna y estándar
- ✅ Soporte webhooks para notificaciones
- ✅ Escalable y asíncrono
- ✅ Fácil monitoreo del estado

#### OPCIÓN 2: Carpeta compartida (Watch Folder)
```
Cliente                          VerbadocPro
  │                                   │
  ├── /entrada/                      │
  │   ├── factura_001.pdf  ──────────┼──→ Detecta nuevo archivo
  │   └── factura_002.pdf            │    Procesa automáticamente
  │                                  │
  │   /salida/                ←──────┼──  Deposita resultado
  │   ├── factura_001.json           │
  │   └── factura_002.json           │
```

**Implementación:**
- FTP/SFTP compartido
- Carpeta de red (SMB/NFS)
- Cloud storage (S3, Azure Blob, Google Drive)

**Ventajas:**
- ✅ Sin desarrollo en cliente
- ✅ Integración legacy
- ✅ Ideal para sistemas antiguos

#### OPCIÓN 3: Email (Entrada) + FTP (Salida)
```
Cliente                          VerbadocPro
  │                                   │
  │  Email a:                         │
  │  procesar@verbadocpro.eu  ────────┼──→ Recibe adjuntos
  │  Asunto: BATCH_enero2024          │    Extrae metadatos del asunto
  │                                   │    Procesa archivos
  │                                   │
  │  FTP download  ←──────────────────┼──  Deposita en FTP cliente
  │  ftp://cliente.com/results/       │
```

#### OPCIÓN 4: SDK Local (Node.js / Python)
```javascript
// Cliente instala SDK
npm install @verbadocpro/sdk

// Código cliente
const VerbadocPro = require('@verbadocpro/sdk');
const client = new VerbadocPro({ apiKey: 'xxx' });

// Procesar carpeta local
const batch = await client.processBatch({
  inputFolder: './facturas_enero/',
  outputFolder: './resultados/',
  template: 'factura_es',
  format: 'csv',
  mode: 'consolidated'
});

console.log(`Procesados: ${batch.processed}/${batch.total}`);
```

**Ventajas:**
- ✅ Máxima flexibilidad
- ✅ Integración en scripts existentes
- ✅ Control total del flujo

### B. Formatos de intercambio (JSON Schema)

#### Archivo de entrada (batch_config.json)
```json
{
  "batch": {
    "id": "batch_cliente_001",
    "name": "Facturas Enero 2024",
    "template": "factura_es",
    "files": [
      {
        "path": "factura_001.pdf",
        "metadata": {
          "origen": "proveedor_A",
          "categoria": "material"
        }
      }
    ],
    "export": {
      "format": ["csv", "json"],
      "mode": "consolidated",
      "include_metadata": true
    },
    "delivery": {
      "method": "webhook",
      "url": "https://cliente.com/api/receive",
      "auth": "Bearer token_xyz"
    }
  }
}
```

#### Archivo de salida (batch_results.json)
```json
{
  "batch_id": "batch_cliente_001",
  "processed_at": "2024-01-07T15:30:00Z",
  "summary": {
    "total": 50,
    "successful": 48,
    "failed": 2,
    "processing_time_seconds": 120
  },
  "results": [
    {
      "file": "factura_001.pdf",
      "status": "success",
      "data": {
        "numero_factura": "F-2024-001",
        "cif": "B12345678",
        "total": 1250.50,
        "fecha": "2024-01-15"
      },
      "confidence": 0.98
    }
  ],
  "files": {
    "consolidated_csv": "https://cdn.verbadocpro.eu/batches/batch_cliente_001/results.csv",
    "consolidated_json": "https://cdn.verbadocpro.eu/batches/batch_cliente_001/results.json"
  }
}
```

---

## 4️⃣ REDISEÑO DE PÁGINA DE RESULTADOS

### Propuesta de nueva UI

```
┌────────────────────────────────────────────────────────────────────┐
│  VERBADOC PRO - Resultados de Procesamiento                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  📁 Lote: Facturas Enero 2024           Estado: ● Completado      │
│  50 archivos | 48 exitosos | 2 fallidos | Procesado: hace 5 min  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  ACCIONES RÁPIDAS                                            │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │  [📥 Descargar Todo CSV]  [📊 Excel]  [🗂️ JSON]  [📦 ZIP]   │ │
│  │  [🔄 Reprocesar Fallidos]  [📧 Enviar por Email]            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  FILTROS Y BÚSQUEDA                                          │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │  🔍 Buscar: [factura_001...]                                 │ │
│  │  Estado: [Todos ▼]  Tipo: [Todos ▼]  Fecha: [Hoy ▼]        │ │
│  │  ☑ Solo seleccionados (5)                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  TABLA DE RESULTADOS                          Vista: ⊞ Tabla │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ ☑ │ Archivo         │ Estado    │ Datos          │ Acciones │ │
│  ├───┼─────────────────┼───────────┼────────────────┼──────────┤ │
│  │ ☑ │ factura_001.pdf │ ✅ Éxito  │ F-2024-001...  │ 👁️ 📥 🗑️ │ │
│  │ ☑ │ factura_002.pdf │ ✅ Éxito  │ F-2024-002...  │ 👁️ 📥 🗑️ │ │
│  │ ☐ │ factura_003.pdf │ ❌ Error  │ QR no detect.  │ 🔄 🗑️   │ │
│  │ ☑ │ factura_004.pdf │ ✅ Éxito  │ F-2024-004...  │ 👁️ 📥 🗑️ │ │
│  │   │ ...             │           │                │          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  Mostrando 1-10 de 50  [◀ Anterior] [1][2][3]...[5] [Siguiente ▶]│
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  VISTA DETALLE: factura_001.pdf                              │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │  ┌─────────────────┬──────────────────────────────────────┐  │ │
│  │  │  DOCUMENTO      │  DATOS EXTRAÍDOS                     │  │ │
│  │  ├─────────────────┼──────────────────────────────────────┤  │ │
│  │  │  [PDF Preview]  │  Número Factura: F-2024-001          │  │ │
│  │  │                 │  CIF Emisor: B12345678               │  │ │
│  │  │                 │  Total: 1,250.50 €                   │  │ │
│  │  │                 │  Fecha: 15/01/2024                   │  │ │
│  │  │                 │  Confianza: 98%                      │  │ │
│  │  │                 │                                      │  │ │
│  │  │                 │  [Editar]  [Validar]  [Exportar]    │  │ │
│  │  └─────────────────┴──────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  EXPORTACIÓN PERSONALIZADA                                   │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │  Archivos seleccionados: 5                                   │ │
│  │  Formato: ⦿ CSV  ○ Excel  ○ JSON  ○ XML                     │ │
│  │  Modo: ⦿ Consolidado  ○ Individual  ○ Ambos                 │ │
│  │  Opciones: ☑ Incluir metadatos  ☑ Incluir confianza         │ │
│  │                                                              │ │
│  │  [📥 Descargar Selección]                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### Vistas alternativas

#### Vista de Tarjetas (Cards)
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ factura_001 │  │ factura_002 │  │ factura_003 │
│ ✅ Procesado │  │ ✅ Procesado │  │ ❌ Error    │
│ F-2024-001  │  │ F-2024-002  │  │ QR no det.  │
│ €1,250.50   │  │ €890.00     │  │             │
│ [Ver] [📥]  │  │ [Ver] [📥]  │  │ [Reintentar]│
└─────────────┘  └─────────────┘  └─────────────┘
```

#### Vista de Carpetas (Tree)
```
📁 Facturas_Enero_2024/
  ├─ 📁 Proveedor_A/ (20 archivos)
  │   ├─ ✅ factura_001.pdf
  │   ├─ ✅ factura_002.pdf
  │   └─ ✅ ...
  ├─ 📁 Proveedor_B/ (15 archivos)
  │   ├─ ✅ factura_021.pdf
  │   └─ ❌ factura_022.pdf (error)
  └─ 📁 Otros/ (15 archivos)
```

---

## 5️⃣ PLAN DE IMPLEMENTACIÓN

### FASE 1: Backend (Prioridad Alta) ⭐
**Tiempo estimado: 2-3 semanas**

1. **API de Batch Processing**
   - Endpoint: `POST /api/v1/batch/create`
   - Endpoint: `GET /api/v1/batch/{id}/status`
   - Endpoint: `GET /api/v1/batch/{id}/download`
   - Cola de procesamiento (Redis/Vercel KV)
   - Sistema de webhooks

2. **Servicio de Exportación**
   - Generador CSV consolidado
   - Generador XML (formato personalizable)
   - Generador Excel con múltiples hojas
   - Compresión ZIP de resultados

3. **Base de datos**
   - Tabla `batches` (lotes de procesamiento)
   - Tabla `batch_files` (archivos del lote)
   - Tabla `export_configurations` (configs de exportación)

### FASE 2: Frontend (Prioridad Alta) ⭐
**Tiempo estimado: 1-2 semanas**

1. **Componente de carga masiva**
   - Drag & drop de carpetas
   - Preview de archivos
   - Selector de plantilla

2. **Página de resultados mejorada**
   - Tabla con filtros y búsqueda
   - Vista detalle de archivo
   - Panel de exportación

3. **Monitor de progreso**
   - Barra de progreso en tiempo real
   - WebSocket para updates live
   - Notificaciones de finalización

### FASE 3: Integración (Prioridad Media)
**Tiempo estimado: 1 semana**

1. **SDK JavaScript/Node.js**
   ```bash
   npm install @verbadocpro/sdk
   ```

2. **Documentación API**
   - OpenAPI/Swagger
   - Ejemplos de código (Node, Python, PHP)
   - Guía de integración

3. **Webhooks y callbacks**
   - Sistema de notificaciones
   - Retry automático
   - Logs de entregas

### FASE 4: Integraciones avanzadas (Prioridad Baja)
**Tiempo estimado: 2 semanas**

1. **Watch Folder Service**
   - Daemon Node.js que monitorea carpetas
   - FTP/SFTP support

2. **Email processor**
   - Recepción de emails con adjuntos
   - Procesamiento automático

3. **Conectores ERP**
   - SAP, Odoo, Microsoft Dynamics

---

## 6️⃣ DECISIONES TÉCNICAS RECOMENDADAS

### Para comenzar AHORA (Quick Wins):

1. **✅ Carga múltiple de archivos**
   - Modificar `FileUploader.tsx` para aceptar múltiples archivos
   - Agregar preview de la cola de procesamiento

2. **✅ Exportación consolidada CSV**
   - Modificar función `downloadCSV` en `exportUtils.ts`
   - Agregar opción "consolidar" vs "individual"

3. **✅ Vista mejorada de resultados**
   - Crear nuevo componente `ResultsPage.tsx`
   - Tabla con paginación y filtros
   - Checkbox para selección múltiple

### Para el futuro (Roadmap):

4. **API REST completa**
   - Endpoints en `/api/v1/`
   - Autenticación con API Keys
   - Rate limiting

5. **Sistema de webhooks**
   - Notificaciones al finalizar batch
   - Entrega automática de resultados

6. **SDK oficial**
   - Paquete npm `@verbadocpro/sdk`
   - CLI: `verbadoc process ./carpeta --template factura`

---

## 7️⃣ COSTOS Y RECURSOS

### Estimación de recursos

| Funcionalidad | Backend | Frontend | Testing | Total |
|---------------|---------|----------|---------|-------|
| Batch upload | 4h | 6h | 2h | 12h |
| Exportación consolidada | 6h | 3h | 2h | 11h |
| Nueva página resultados | 2h | 12h | 3h | 17h |
| API REST | 16h | 4h | 6h | 26h |
| Webhooks | 8h | 2h | 4h | 14h |
| SDK Node.js | 12h | 0h | 6h | 18h |
| **TOTAL** | **48h** | **27h** | **23h** | **98h** |

### Priorización sugerida

**Sprint 1 (1 semana):**
- Carga múltiple de archivos
- Exportación consolidada CSV
- Mejoras básicas en vista de resultados

**Sprint 2 (1 semana):**
- Nueva página de resultados completa
- Sistema de selección y filtros
- Preview de documentos

**Sprint 3 (2 semanas):**
- API REST básica
- Sistema de batch processing
- Webhooks

**Sprint 4 (1 semana):**
- SDK oficial
- Documentación
- Ejemplos de integración

---

## 🚀 SIGUIENTE PASO

**¿Por dónde empezamos?**

Recomiendo empezar con las **Quick Wins** para dar valor inmediato:

1. ✅ **Esta semana**: Carga múltiple + Exportación consolidada
2. ✅ **Próxima semana**: Nueva página de resultados
3. ✅ **Después**: API REST y batch processing

**¿Te parece bien este plan?** ¿Quieres que empiece por alguna funcionalidad específica?
