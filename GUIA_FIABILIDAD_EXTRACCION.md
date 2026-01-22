# Guía de Fiabilidad en la Extracción de Documentos FUNDAE

## Introducción

Este documento explica cómo funciona el sistema de fiabilidad implementado para garantizar la máxima precisión en la extracción de los 16,000 formularios FUNDAE.

---

## 1. Configuración de la IA (Temperature=0)

### ¿Qué es?
La "temperatura" controla cuánta creatividad/aleatoriedad tiene la IA al responder.

### ¿Qué hicimos?
- **Temperature = 0**: La IA siempre da la misma respuesta para el mismo documento
- **TopP = 1, TopK = 1**: Solo elige la palabra más probable, sin variaciones

### ¿Por qué importa?
| Temperature | Comportamiento |
|-------------|----------------|
| 0.0 | Siempre igual, predecible, fiable |
| 0.7 | Algo de variación, puede inventar |
| 1.0 | Muy creativo, puede alucinar datos |

**Archivo:** `api/extract.ts`

---

## 2. Prompt Mejorado para FUNDAE

### ¿Qué es?
Las instrucciones que le damos a la IA para extraer datos del formulario.

### Mejoras implementadas:

1. **Reglas estrictas de fiabilidad:**
   ```
   - NUNCA INVENTES DATOS
   - NUNCA ADIVINES
   - Si hay DUDA, devuelve null
   ```

2. **Instrucciones campo por campo:**
   - Formato exacto de cada campo (CIF: letra + 8 dígitos)
   - Valores válidos para cada opción (sexo: 1, 2 o 9)
   - Dónde buscar cada dato en el formulario

3. **Manejo de formularios escritos a mano:**
   - Marcas válidas: X, ✓, círculo, tachado
   - Si no es legible → null

**Archivo:** `src/constants/fundae-template.ts`

---

## 3. Cálculo Real de Confianza

### Antes vs Ahora

| Antes | Ahora |
|-------|-------|
| Siempre 95% (inventado) | Calculado según los datos reales |

### ¿Cómo se calcula?

```
Confianza = 100% - Penalizaciones

Penalizaciones:
- Campo crítico faltante: -15% cada uno
- Campo importante faltante: -5% cada uno
- Formato inválido: -3% cada uno
- Valoración vacía: -2% cada una
- Inconsistencia detectada: -5% cada una
```

### Campos críticos (los más importantes):
- `numero_expediente`
- `numero_accion`
- `numero_grupo`
- `cif_empresa`
- `denominacion_aaff`

### Niveles de confianza:

| Score | Nivel | Qué hacer |
|-------|-------|-----------|
| ≥85% | Alto | Documento fiable, verificación mínima |
| 65-84% | Medio | Revisar campos marcados |
| <65% | Bajo | Revisión manual completa obligatoria |

**Archivo:** `api/_lib/confidenceService.ts`

---

## 4. Sistema de Doble Verificación

### ¿Qué es?
Extraer los campos críticos DOS VECES con prompts diferentes y comparar.

### ¿Cómo funciona?

```
1. Primera extracción (prompt completo)
   → expediente: "F240001"
   → accion: "1"
   → grupo: "5"
   → cif: "B12345678"

2. Segunda extracción (prompt simplificado)
   → expediente: "F240001"  ✅ Coincide
   → accion: "1"            ✅ Coincide
   → grupo: "5"             ✅ Coincide
   → cif: "B12345678"       ✅ Coincide

3. Resultado: VERIFICADO ✅
```

### Si hay discrepancias:

```
Primera:  cif = "B12345678"
Segunda:  cif = "B12345679"

→ Se marca para REVISIÓN HUMANA
→ Se reduce la confianza (-10% por discrepancia)
```

### ¿Cuándo usar doble verificación?
- Documentos de alto riesgo
- Cuando la confianza inicial es media/baja
- Lotes críticos que no pueden tener errores

**Archivo:** `api/_lib/doubleVerificationService.ts`

---

## 5. Detección Inteligente de Tipo de PDF

### Tipos de PDF:

| Tipo | Descripción | Modelo recomendado |
|------|-------------|-------------------|
| **OCR** | PDF con texto extraíble | gemini-2.5-flash |
| **Imagen** | PDF escaneado (solo imágenes) | gemini-2.5-pro |
| **Mixto** | Algunas páginas texto, otras imagen | gemini-2.5-pro |

### Análisis de calidad de texto:

El sistema analiza el texto extraído y le da una puntuación:

```
Calidad = 0-100 puntos

Se evalúa:
- ¿Las palabras tienen sentido en español?
- ¿Hay muchos caracteres raros (@#$%)?
- ¿La longitud de palabras es normal?
- ¿Aparecen palabras comunes (de, la, el, formación)?
```

### Detección de OCR malo:

```
Texto bueno:  "Cuestionario de Evaluación de Calidad"
Texto malo:   "Cu3st!0nar!0 d3 Ev@lu@c!0n d3 C@l!d@d"
              ↑ OCR deficiente, caracteres mal leídos
```

Si detecta texto malo → Recomienda modelo avanzado (pro)

**Archivo:** `src/services/pdfAnalysisService.ts`

---

## Flujo Completo de Procesamiento

```
┌──────────────────────────────────────────────────────────┐
│                    DOCUMENTO PDF                          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  PASO 1: Análisis del PDF                                │
│  ─────────────────────────                               │
│  • ¿Tiene texto o es imagen?                             │
│  • ¿Qué calidad tiene el texto?                          │
│  • Modelo recomendado: flash o pro                       │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  PASO 2: Extracción con IA                               │
│  ─────────────────────────                               │
│  • Temperature = 0 (sin aleatoriedad)                    │
│  • Prompt específico FUNDAE                              │
│  • Extrae ~45 campos del formulario                      │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  PASO 3: Doble Verificación (opcional)                   │
│  ────────────────────────────────────                    │
│  • Re-extrae campos críticos                             │
│  • Compara con primera extracción                        │
│  • Detecta discrepancias                                 │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  PASO 4: Cálculo de Confianza                            │
│  ────────────────────────────                            │
│  • Cuenta campos extraídos vs esperados                  │
│  • Valida formatos (CIF, fechas, códigos)                │
│  • Detecta inconsistencias                               │
│  • Score final: 0-100%                                   │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  PASO 5: Decisión                                        │
│  ───────────────                                         │
│                                                          │
│  Confianza ≥85%  →  ✅ VÁLIDO (Excel Master)            │
│  Confianza 65-84% →  ⚠️ REVISIÓN (Panel de Revisión)    │
│  Confianza <65%  →  ❌ REVISIÓN OBLIGATORIA             │
└──────────────────────────────────────────────────────────┘
```

---

## Costos Estimados

### Modelos disponibles:

| Modelo | Costo/doc | Uso recomendado |
|--------|-----------|-----------------|
| gemini-2.5-flash | ~$0.0016 | PDFs con buen texto |
| gemini-2.5-pro | ~$0.008 | PDFs escaneados o difíciles |

### Para 16,000 documentos:

| Escenario | Costo estimado |
|-----------|----------------|
| 100% flash | ~$25.60 |
| 80% flash + 20% pro | ~$46.08 |
| 50% flash + 50% pro | ~$76.80 |

La detección automática de tipo de PDF optimiza el costo usando el modelo más barato cuando es posible.

---

## Preguntas Frecuentes

### ¿La doble verificación duplica el costo?
Sí, si se activa. Por eso es opcional y solo para campos críticos (4 campos, no los 45).

### ¿Qué pasa si un documento tiene confianza del 50%?
Va automáticamente a "Revisión" donde un humano debe verificar los datos antes de aprobar.

### ¿Puedo forzar el uso del modelo pro?
Sí, en la configuración del procesamiento puedes seleccionar manualmente el modelo.

### ¿Los cambios afectan documentos ya procesados?
No, solo aplican a nuevos documentos. Los existentes mantienen su score original.

---

## Archivos Modificados

| Archivo | Función |
|---------|---------|
| `api/extract.ts` | Temperature=0 |
| `src/constants/fundae-template.ts` | Prompt mejorado |
| `api/_lib/confidenceService.ts` | Cálculo de confianza |
| `api/_lib/doubleVerificationService.ts` | Doble verificación |
| `src/services/pdfAnalysisService.ts` | Detección de tipo PDF |
| `api/extractions/index.ts` | Integración de todo |

---

*Última actualización: Enero 2026*
