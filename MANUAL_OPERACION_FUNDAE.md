# 📋 Manual de Operación - Procesamiento de Formularios FUNDAE

**Proyecto:** VerbadocPro - Sistema Profesional de Extracción de Datos FUNDAE
**Versión:** 1.0
**Fecha:** 2026-01-10
**Cliente:** Administraciones Públicas / Instituciones

---

## 📚 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estado Actual del Sistema](#estado-actual-del-sistema)
3. [Plan de Implementación](#plan-de-implementación)
4. [Fase 1: Validaciones FUNDAE](#fase-1-validaciones-fundae-completada-)
5. [Fase 2: Sistema de Carga de Excel](#fase-2-sistema-de-carga-de-excel)
6. [Fase 3: Visor PDF Mejorado](#fase-3-visor-pdf-mejorado)
7. [Fase 4: Sistema de Pruebas](#fase-4-sistema-de-pruebas)
8. [Fase 5: Integración y Testing](#fase-5-integración-y-testing)
9. [Fase 6: Documentación Final](#fase-6-documentación-final)
10. [Guía de Uso del Sistema](#guía-de-uso-del-sistema)
11. [Capacidad de Producción](#capacidad-de-producción)
12. [Checklist de Verificación](#checklist-de-verificación)

---

## 📊 RESUMEN EJECUTIVO

### Objetivo
Transformar VerbadocPro en una solución de nivel institucional para procesar **~3,700 PDFs** (~12,000 formularios FUNDAE de 2 páginas) con máxima seguridad, robustez y trazabilidad.

### Volumen de Trabajo
- **PDFs totales:** ~3,700 archivos
- **Formularios totales:** ~12,000 (cada formulario = 2 páginas)
- **Tipos de PDF:** Digitales, manuscritos, escaneados
- **Capacidad estimada:** 1,200 formularios/día
- **Tiempo total:** 10-12 días laborales

### Estándares
- ✅ **GDPR Compliance** (100% procesamiento en Europa)
- ✅ **Máxima seguridad** (Vertex AI region europe-west1)
- ✅ **Trazabilidad completa** (logs en PostgreSQL)
- ✅ **Validación exhaustiva** (reglas específicas FUNDAE)

---

## 🏗️ ESTADO ACTUAL DEL SISTEMA

### ✅ Componentes Implementados y Funcionales

#### 1. Motor de Procesamiento IA
- **Tecnología:** Gemini/Vertex AI (region europe-west1, Bélgica)
- **Detección automática:** PDF texto, imagen, mixto
- **Modelos disponibles:**
  - `gemini-2.5-flash` (rápido, económico)
  - `gemini-2.5-pro` (máxima precisión)
  - `gemini-2.5-flash-lite` (ultra-rápido)
- **Archivos clave:**
  - `api/extract.ts`
  - `services/geminiService.ts`
  - `src/services/pdfAnalysisService.ts`

#### 2. Sistema de Validación (EXTENDIDO con FUNDAE)
**Validaciones generales:**
- ✅ CIF (con dígito de control)
- ✅ DNI/NIE (con letra de control)
- ✅ Fechas (formato DD/MM/YYYY, rangos, coherencia)
- ✅ Códigos postales (5 dígitos, provincia 01-52)
- ✅ Teléfonos españoles (9 dígitos)
- ✅ Emails (RFC 5322)
- ✅ Edad (16-99 años)

**Validaciones FUNDAE específicas (✅ IMPLEMENTADAS):**
- ✅ Encabezado "FORMACIÓN DE DEMANDA" (orden TAS 2307/2025)
- ✅ Sección I: expediente, CIF, denominación (campos 1, 4, 5)
- ✅ Sección II: edad, sexo, titulación, lugar trabajo, categoría
- ✅ Sección III: valoraciones escala 1-4 (excepto pregunta 10)
- ✅ Detección múltiples respuestas → "NC" automático
- ✅ Catálogo códigos ciudades (BCN→Barcelona, MAD→Madrid)

**Archivos:**
- `src/services/validationRules.ts` (681 líneas)
- `src/services/fundaeValidationRules.ts` (500+ líneas) ✅ NUEVO
- `src/services/validationService.ts` (515 líneas) ✅ ACTUALIZADO
- `src/data/cityCodes.ts` (250+ líneas) ✅ NUEVO

#### 3. Base de Datos PostgreSQL
- **Tablas:** 7 principales + 3 vistas
- **Funciones PL/pgSQL:** 10+ para estadísticas
- **Índices:** GIN para JSONB, índices compuestos
- **Trazabilidad:** Completa de todos los cambios

#### 4. Procesamiento Batch
- Procesamiento secuencial y paralelo
- Segmentación automática de múltiples formularios
- Monitoreo en tiempo real
- Exportación a Excel/CSV/JSON

#### 5. Sistema de Revisión Humana
- ✅ Cola de documentos pendientes
- ✅ Panel de revisión con navegación de errores
- ✅ Workflow aprobación/rechazo
- ⚠️ Visor PDF básico (requiere mejora)
- ✅ Sistema de email (Resend)

#### 6. Excel Import/Export
- ✅ Importación de Excel de referencia
- ✅ Exportación multi-hoja
- ✅ Mapeo flexible de columnas

---

## 📅 PLAN DE IMPLEMENTACIÓN

### Estimación de Tiempos

| Fase | Duración | Estado | Prioridad |
|------|----------|--------|-----------|
| **Fase 1: Validaciones FUNDAE** | 2-3 días | ✅ **COMPLETADA** | MÁXIMA |
| **Fase 2: Sistema de Excel** | 2 días | ⏳ Pendiente | ALTA |
| **Fase 3: Visor PDF Mejorado** | 2-3 días | ⏳ Pendiente | ALTA |
| **Fase 4: Sistema de Pruebas** | 3-4 días | ⏳ Pendiente | ALTA |
| **Fase 5: Integración y Testing** | 2 días | ⏳ Pendiente | MEDIA |
| **Fase 6: Documentación Final** | 1 día | ⏳ Pendiente | BAJA |
| **TOTAL** | **12-15 días** | | |

---

## ✅ FASE 1: VALIDACIONES FUNDAE (COMPLETADA)

### Lo que se ha implementado

#### 1. Archivo `fundaeValidationRules.ts`

**Ubicación:** `src/services/fundaeValidationRules.ts`

**Funciones principales:**

```typescript
// Validación de encabezado (CRÍTICO)
validateFundaeHeader(extractedData)
// Rechaza si no contiene "FORMACIÓN DE DEMANDA" y "orden TAS 2307/2025"

// Validación Sección I (CRÍTICO)
validateSeccionI(datos, referenceData?)
// Valida: expediente, CIF, denominación
// Cruza con Excel de referencia si existe

// Validación Sección II (ALTO)
validateSeccionII(datos, cityCodesMap?)
// Valida: edad (16-99), sexo, titulación, lugar trabajo, categoría
// Expande códigos de ciudades: BCN → Barcelona

// Validación Valoraciones (MEDIO)
validateValoraciones(valoraciones)
// Valida escala 1-4 (excepto pregunta 10 que permite texto)

// Detección múltiples respuestas
detectMultipleAnswers(fieldValue, fieldName)
// Detecta: arrays, valores separados por "/, ,, ;, |, y"
// Marca automáticamente como "NC"

// Orquestador principal
validateFundaeFormulario(extractedData, referenceData?, cityCodesMap?)
// Ejecuta todas las validaciones en orden
// Retorna: { isValid, status, errors, processedData, ncFields }
```

**Estados de Validación:**
- `valid`: Sin errores, listo para exportar
- `needs_review`: Errores detectados, requiere revisión humana
- `rejected`: Error crítico (encabezado), no es formulario FUNDAE válido

#### 2. Catálogo de Códigos de Ciudades

**Ubicación:** `src/data/cityCodes.ts`

**Funciones:**

```typescript
// Mapeo estático de 50+ ciudades
CITY_CODES = {
  'MAD': 'Madrid',
  'BCN': 'Barcelona',
  'VLC': 'Valencia',
  // ... más ciudades
}

// Resolver código a nombre completo
resolveCityCode('BCN') // → "Barcelona"

// Cargar desde Excel del cliente
loadCityCodesFromExcel(excelBuffer)

// Guardar en localStorage
saveCityCodesCatalog(codes)

// Cargar desde localStorage
loadCityCodesCatalog()

// Búsqueda para autocompletado
searchCities('bar') // → [{ code: "BCN", city: "Barcelona" }]
```

#### 3. Integración en `validationService.ts`

**Nuevas funciones exportadas:**

```typescript
// Validación completa de 1 formulario FUNDAE
validateFundaeFormularioComplete(extractionId, extractedData, referenceData?)
// Valida, guarda errores en BD, retorna resultado completo

// Validación de lote
validateFundaeBatch(extractions)
// Valida múltiples formularios
// Retorna estadísticas: total, valid, needsReview, rejected
```

### Cómo usar las validaciones

#### Ejemplo 1: Validar un formulario

```typescript
import { validateFundaeFormularioComplete } from '@/services/validationService';

const result = await validateFundaeFormularioComplete(
  'extraction-id-123',
  extractedData,
  referenceDataFromExcel  // opcional
);

console.log(result.status);  // 'valid' | 'needs_review' | 'rejected'
console.log(result.errors);  // Array de errores con severidad
console.log(result.ncFields);  // Campos marcados como NC
```

#### Ejemplo 2: Validar lote

```typescript
import { validateFundaeBatch } from '@/services/validationService';

const extractions = [
  { id: 'ext-1', extractedData: {...}, referenceData: {...} },
  { id: 'ext-2', extractedData: {...}, referenceData: {...} },
  // ... más extracciones
];

const stats = await validateFundaeBatch(extractions);

console.log(`✅ Válidos: ${stats.valid} (${stats.valid/stats.total*100}%)`);
console.log(`⚠️  Revisión: ${stats.needsReview}`);
console.log(`❌ Rechazados: ${stats.rejected}`);
```

---

## 📂 FASE 2: SISTEMA DE CARGA DE EXCEL

### Objetivo
Crear interfaz de administración para cargar y gestionar los 3 Excel del cliente:
1. **Excel de Validación** (datos oficiales para cruzar)
2. **Excel Plantilla de Salida** (columnas destino)
3. **Catálogo de Códigos de Ciudades**

### Componentes a Crear

#### 1. ExcelManagementPanel.tsx
**Ubicación:** `src/components/admin/ExcelManagementPanel.tsx`

**Funcionalidad:**
- Carga de 3 archivos Excel
- Previsualización de datos antes de confirmar
- Validación de estructura
- Guardado en localStorage/BD

#### 2. ColumnMappingEditor.tsx
**Ubicación:** `src/components/admin/ColumnMappingEditor.tsx`

**Funcionalidad:**
- Mapeo manual de campos FUNDAE → columnas Excel
- Visualización de mapeo sugerido
- Guardado de configuración

#### 3. Migración BD
**Ubicación:** `database/migrations/007_create_column_mappings.sql`

```sql
CREATE TABLE column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  mapping_name VARCHAR(100),
  mappings JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Flujo de Uso

1. Usuario accede a `/admin/excel-management`
2. Carga los 3 archivos Excel
3. Sistema previsualiza datos
4. Usuario confirma carga
5. Sistema guarda en BD/localStorage
6. Usuario accede a `/admin/column-mapping`
7. Mapea campos FUNDAE → columnas Excel
8. Guarda configuración

---

## 🔍 FASE 3: VISOR PDF MEJORADO

### Objetivo
Implementar visor PDF profesional con zoom, highlights y sincronización con errores

### Mejoras a Implementar

#### 1. Instalar Dependencias

```bash
npm install react-pdf pdfjs-dist
npm install @types/react-pdf --save-dev
```

#### 2. Actualizar PdfViewer.tsx

**Funcionalidades:**
- ✅ Zoom in/out/reset
- ✅ Navegación de páginas
- ✅ Highlights superpuestos en errores
- ✅ Click en highlight → navega a error
- ✅ Renderizado con TextLayer y AnnotationLayer

#### 3. Integrar en ReviewPanel.tsx

**Sincronización bidireccional:**
- Click en error → resalta en PDF
- Click en highlight PDF → navega a error

---

## 🧪 FASE 4: SISTEMA DE PRUEBAS

### Objetivo
Crear suite de pruebas exhaustiva para validar el sistema con formularios reales y generados

### Estructura de Tests

```
tests/fundae/
├── fixtures/
│   ├── formulario_texto_digital.pdf
│   ├── formulario_manuscrito.pdf
│   ├── formulario_imagen.pdf
│   ├── archivo_multiples_formularios.pdf
│   └── excel/
│       ├── datos_validacion.xlsx
│       ├── plantilla_salida.xlsx
│       └── codigos_ciudades.xlsx
├── unit/
│   ├── fundae-validation.test.ts
│   ├── city-codes.test.ts
│   └── multiple-answers.test.ts
├── integration/
│   ├── formulario-completo.test.ts
│   ├── batch-processing.test.ts
│   └── excel-export.test.ts
└── stress/
    ├── test-100-formularios.ts
    ├── test-500-formularios.ts
    └── generador-formularios-fake.ts
```

### Tests a Implementar

#### 1. Tests Unitarios
```typescript
// test: validateFundaeHeader()
// test: validateSeccionI()
// test: validateSeccionII()
// test: validateValoraciones()
// test: detectMultipleAnswers()
```

#### 2. Tests de Integración
```typescript
// test: Procesamiento completo 1 formulario
// test: Batch processing 10-50 formularios
// test: Exportación a Excel
```

#### 3. Generador de Formularios Fake
```typescript
generarFormularioFake({
  calidad: 'perfecto' | 'bueno' | 'regular' | 'malo',
  tipo: 'digital' | 'escaneado' | 'manuscrito',
  errores: ['cif_invalido', 'edad_incorrecta', ...]
})
```

#### 4. Stress Test
```typescript
// Test con 100 formularios
// Test con 500 formularios
// Medición de capacidad de producción
```

---

## 🔗 FASE 5: INTEGRACIÓN Y TESTING

### Protocolo de Pruebas Progresivas

#### Test 1: Formulario Digital Perfecto
**Objetivo:** Validar extracción básica
**Comando:** `npm run test:fundae:single -- --file=formulario_texto_digital.pdf`
**Resultado esperado:**
- ✅ Extracción completa (100% campos)
- ✅ Validación exitosa
- ✅ Exportación a Excel

#### Test 2: Formulario Manuscrito
**Objetivo:** Validar OCR y corrección manual
**Comando:** `npm run test:fundae:single -- --file=formulario_manuscrito.pdf`
**Resultado esperado:**
- ⚠️ Extracción parcial (80-90% campos)
- ⚠️ 2-3 campos en revisión
- ✅ Workflow de corrección funcional

#### Test 3: Formulario Imagen Escaneada
**Objetivo:** Validar modelo PRO automático
**Comando:** `npm run test:fundae:single -- --file=formulario_imagen.pdf`
**Resultado esperado:**
- ✅ Detección automática de PDF imagen
- ✅ Uso de gemini-2.5-pro
- ⚠️ Revisión humana para campos críticos

#### Test 4: Archivo Múltiples Formularios
**Objetivo:** Validar segmentación
**Comando:** `npm run test:fundae:batch -- --file=archivo_multiples.pdf --count=10`
**Resultado esperado:**
- ✅ Segmentación en 10 documentos de 2 páginas
- ✅ Procesamiento individual
- ✅ Exportación consolidada

#### Test 5: Lote Pequeño (50 formularios)
**Objetivo:** Validar batch processing
**Comando:** `npm run test:fundae:batch -- --count=50`
**Resultado esperado:**
- ✅ Procesamiento en <5 minutos
- ✅ >85% formularios válidos
- ✅ Cola de revisión funcional

#### Test 6: Lote Grande (500 formularios)
**Objetivo:** Stress test y capacidad
**Comando:** `npm run test:fundae:stress -- --count=500`
**Resultado esperado:**
- ✅ Procesamiento completo sin caídas
- ✅ Métricas de producción registradas
- ✅ Reporte de capacidad generado

---

## 📖 FASE 6: DOCUMENTACIÓN FINAL

### Documentos a Generar

1. **Manual de Usuario** (para operadores)
   - Cómo cargar PDFs
   - Cómo revisar errores
   - Cómo aprobar/rechazar
   - Cómo exportar resultados

2. **Manual Técnico** (para desarrolladores)
   - Arquitectura del sistema
   - APIs disponibles
   - Flujos de datos
   - Troubleshooting

3. **Guía de Mantenimiento**
   - Backup de BD
   - Limpieza de archivos huérfanos
   - Monitoreo de rendimiento
   - Actualización de catálogos

---

## 🎯 GUÍA DE USO DEL SISTEMA

### 1. PREPARACIÓN DEL SISTEMA

#### 1.1 Carga de Excel del Cliente

1. Acceder a Panel de Administración: `/admin/excel-management`
2. Cargar 3 archivos Excel:
   - **Excel de Validación:** Datos oficiales (expediente, CIF, razón social)
   - **Excel Plantilla:** Columnas destino para resultados
   - **Catálogo de Ciudades:** Códigos BCN, MAD, etc.
3. Verificar previsualización de datos
4. Confirmar carga

#### 1.2 Configurar Mapeo de Columnas

1. Ir a: `/admin/column-mapping`
2. Asignar cada campo FUNDAE a columna Excel
3. Guardar configuración

### 2. PROCESAMIENTO DE FORMULARIOS

#### 2.1 Carga de PDFs

**Opción A: Carga Individual**
- Arrastrar y soltar 1 PDF
- Sistema detecta automáticamente tipo (texto/imagen)
- Procesa y muestra resultados

**Opción B: Carga por Lotes**
- Seleccionar múltiples PDFs (hasta 100)
- Crear lote con nombre descriptivo
- Iniciar procesamiento batch

#### 2.2 Validación Automática

El sistema valida automáticamente:
- ✅ Encabezado FUNDAE (orden TAS 2307/2025)
- ✅ Campos 1, 4, 5 de Sección I vs Excel
- ✅ Edad (16-99 años)
- ✅ Valoraciones (escala 1-4)
- ✅ CIF con dígito de control
- ✅ Múltiples respuestas → convierte a "NC"

#### 2.3 Resultados

**Formularios Válidos (85-90%)**
- Exportados automáticamente a Excel
- Disponibles para descarga inmediata

**Formularios con Errores (10-15%)**
- Encolados para revisión humana
- Notificación por email al supervisor

### 3. REVISIÓN HUMANA

#### 3.1 Acceder a Cola de Revisión

1. Ir a: `/review`
2. Ver lista de formularios pendientes
3. Click en "Revisar" para abrir formulario

#### 3.2 Panel de Revisión

**Lado Izquierdo: Visor PDF**
- Zoom con botones o rueda del ratón
- Navegación de páginas
- Highlights automáticos en campos con errores

**Lado Derecho: Panel de Errores**
- Error actual con detalles
- Navegación entre errores (◄ ►)
- Botones:
  - **Corregir Error:** Abrir modal, ingresar valor correcto
  - **Ignorar:** Solo errores no-críticos

#### 3.3 Aprobar o Rechazar

- **Aprobar:** Marcar formulario como válido, exportar a Excel
- **Rechazar:** Indicar motivo, mover a carpeta de no procesables

### 4. EXPORTACIÓN DE RESULTADOS

#### 4.1 Excel Consolidado

1. Ir a: `/export`
2. Seleccionar rango de fechas
3. Elegir formato: Excel / CSV / PDF
4. Descargar

#### 4.2 Estructura del Excel

**Hoja 1: Datos Principales**
- 1 fila por formulario
- Columnas según mapeo configurado
- Valores normalizados

**Hoja 2: Errores y NC**
- Campos marcados como "NC"
- Motivo de NC
- Errores corregidos manualmente

**Hoja 3: No Procesables**
- Formularios rechazados
- Motivo de rechazo
- Log de errores

---

## 📊 CAPACIDAD DE PRODUCCIÓN

### Estimaciones Basadas en Realidad

**Escenario Conservador:**
- Formularios digitales: **2.5s/formulario** → 1,440 formularios/día
- Formularios escaneados: **6s/formulario** → 600 formularios/día
- Mix 70/30: **~1,200 formularios/día**

**Para 12,000 formularios:**
- Procesamiento IA: **10 días**
- Revisión humana (10%): **1-2 días**
- **TOTAL: 11-12 días laborales**

**Escenario Optimista (con optimizaciones):**
- **1,800 formularios/día**
- **TOTAL: 7-8 días laborales**

### Métricas a Monitorear

1. **Dashboard de Producción:**
   - Total formularios procesados
   - Tasa de éxito (%)
   - Formularios en revisión
   - Tiempo promedio de procesamiento

2. **Capacidad Actual:**
   - Formularios/hora
   - Formularios/día (8h laborales)
   - Días estimados para 12,000 formularios

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Pre-Producción

#### Configuración
- [ ] Excel de validación cargado y activo
- [ ] Excel plantilla de salida configurado
- [ ] Catálogo de ciudades cargado
- [ ] Mapeo de columnas definido

#### Tests Funcionales
- [ ] Test con 1 formulario digital: PASS
- [ ] Test con 1 formulario manuscrito: PASS
- [ ] Test con 1 formulario imagen: PASS
- [ ] Test con archivo múltiples formularios: PASS
- [ ] Test batch 50 formularios: PASS
- [ ] Test stress 500 formularios: PASS

#### Interfaz
- [ ] Visor PDF con zoom funcionando
- [ ] Highlights en errores funcionando
- [ ] Sistema de email configurado
- [ ] Workflow aprobación/rechazo funcionando
- [ ] Exportación a Excel correcta

#### Métricas
- [ ] Métricas de capacidad calculadas
- [ ] Documentación completa entregada

---

## 🔧 DEPENDENCIAS Y PREREQUISITOS

### Software Requerido
- Node.js 18+
- PostgreSQL 14+
- Cuenta Google Cloud (Vertex AI habilitada)
- Cuenta Vercel (Postgres + Blob Storage)
- Cuenta Resend (emails)

### Excel del Cliente
- Excel validación (formato: expediente, CIF, razón_social)
- Excel plantilla salida (columnas definidas)
- Catálogo ciudades (formato: código, nombre_completo)

### PDFs de Prueba
- Mínimo 3 formularios reales (digital, manuscrito, imagen)
- Archivo con múltiples formularios
- Formularios con errores conocidos (para testing)

---

## 📞 SOPORTE Y CONTACTO

**Para dudas técnicas:**
- Revisar este manual
- Consultar plan completo: `.claude/plans/fluttering-conjuring-teapot.md`
- Revisar código fuente comentado

**Archivos clave:**
- Validaciones FUNDAE: `src/services/fundaeValidationRules.ts`
- Códigos ciudades: `src/data/cityCodes.ts`
- Servicio validación: `src/services/validationService.ts`

---

**Última actualización:** 2026-01-10
**Versión del documento:** 1.0
**Estado del proyecto:** Fase 1 completada, Fases 2-6 pendientes
