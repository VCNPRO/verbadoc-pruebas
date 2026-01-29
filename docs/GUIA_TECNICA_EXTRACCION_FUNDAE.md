# Guia Tecnica de Desarrollo — Extraccion de Formularios FUNDAE

**Proyecto:** Verbadoc Pro — Modulo de Extraccion Hibrida
**Version:** 2.0 (Gemini Direct Read)
**Fecha:** 29 de enero de 2026
**Estado:** Produccion (verbadocpro-pruebas.vercel.app)

---

## 1. Resumen Ejecutivo

Sistema de extraccion automatizada de formularios FUNDAE (Cuestionario de Evaluacion de la Calidad) que procesa PDFs escaneados/rellenados a mano y extrae 43 campos (texto + checkboxes + valoraciones).

**Modelo actual:** Gemini 3 Pro Preview
**Precision:** 5/5 campos problematicos correctos en testing
**Tiempo por formulario:** ~58 segundos
**Coste por formulario:** ~$0.01
**Coste estimado 3.500 formularios:** ~$35

---

## 2. Arquitectura del Sistema

### 2.1 Flujo de Procesamiento

```
Usuario sube PDF
       |
       v
Frontend (React) --> POST /api/extract-hybrid
       |
       v
[PASO 1] pdfRenderer.ts
   - pdfjs-dist-legacy + @napi-rs/canvas
   - Renderiza PDF a PNG, 300 DPI
   - Solo paginas 1 y 2 (donde estan los datos FUNDAE)
       |
       v
[PASO 2] hybridExtractor.ts
   - Envia PNGs como base64 a Gemini 3 Pro
   - Prompt exhaustivo con 43 campos + reglas de lectura
   - temperature: 0, topK: 1 (determinista)
   - Gemini devuelve JSON con todos los valores
       |
       v
[PASO 3] Validacion y normalizacion
   - Valores de valoracion: solo NC/1/2/3/4/NA
   - Valores binarios: solo Si/No/NC
   - Null -> "NC" (nunca null en la salida)
   - Post-proceso: si modalidad=Presencial -> 7.1/7.2="NA"
       |
       v
[PASO 4] Respuesta JSON al frontend
   - extractedData: todos los campos
   - overallConfidence: porcentaje de confianza
   - processingTimeMs: tiempo total
```

### 2.2 Archivos Clave

| Archivo | Funcion |
|---------|---------|
| `api/extract-hybrid.ts` | Endpoint API. Recibe PDF base64, orquesta la extraccion |
| `api/_lib/hybridExtractor.ts` | Logica principal. Prompt, llamada a Gemini, validacion |
| `api/_lib/pdfRenderer.ts` | Renderiza PDF a PNG con pdfjs-dist + canvas |
| `api/_lib/checkboxJudge.ts` | CV Judge (NO SE USA actualmente, legacy) |
| `api/_lib/geminiLocator.ts` | Localizador de coordenadas (NO SE USA, legacy) |
| `api/_lib/fundaeCoordinatesFallback.js` | Coordenadas fijas fallback (NO SE USA, legacy) |
| `services/geminiService.ts` | Frontend: routing de llamadas a la API |

### 2.3 Dependencias Criticas

```json
{
  "sharp": "procesamiento de imagenes (legacy, ya no se usa para checkboxes)",
  "@google/genai": "SDK de Gemini API",
  "pdfjs-dist-legacy": "renderizado PDF server-side (alias de pdfjs-dist)",
  "@napi-rs/canvas": "canvas nativo para Node.js (reemplaza node-canvas)"
}
```

---

## 3. Modelo de IA: Evaluacion Comparativa

### 3.1 Resultados del Benchmark (PDF 1973)

Campos evaluados: sexo, valoracion_8_1, valoracion_8_2, valoracion_4_1_tutores, modalidad.

| Modelo | sexo | 8.1 | 8.2 | tutores | modalidad | Tiempo | Coste/form |
|--------|------|-----|-----|---------|-----------|--------|------------|
| gemini-2.0-flash | MAL | OK | OK | MAL | MAL | 6s | ~$0.001 |
| gemini-2.5-flash | MAL | MAL | MAL | OK | MAL | 17s | ~$0.004 |
| gemini-2.5-pro | MAL | MAL | MAL | MAL | OK | 36s | ~$0.008 |
| gemini-3-flash-preview | OK | MAL | MAL | OK | OK | 32s | ~$0.004 |
| **gemini-3-pro-preview** | **OK** | **OK** | **OK** | **OK** | **OK** | **58s** | **~$0.01** |

### 3.2 Decision: Gemini 3 Pro Preview

**Razon:** Unico modelo que acerto 5/5 campos problematicos. La diferencia de coste ($14 vs $35 para 3.500 formularios) no justifica la perdida de precision.

**Riesgos del modelo preview:**
- Puede cambiar de comportamiento sin aviso
- Google puede deprecarlo (como hizo con 2.0-flash, deprecado 31/03/2026)
- Cuando salga la version estable, migrar a `gemini-3-pro`

### 3.3 Configuracion del Modelo

```typescript
config: {
  responseMimeType: 'application/json',  // Fuerza salida JSON
  temperature: 0,                         // Determinista
  topK: 1,                                // Solo el token mas probable
  topP: 0.1,                              // Minima variabilidad
}
```

---

## 4. Prompt Engineering

### 4.1 Principios del Prompt Actual

1. **Exhaustividad:** Lista los 43 campos exactos con nombres, codigos y formatos
2. **Reglas negativas:** "NUNCA devuelvas null", "NO inventes valores"
3. **Definicion de marca:** "trazo de boligrafo visible (X, relleno, tachadura) DENTRO del cuadrado"
4. **Definicion de vacio:** "Los bordes impresos del cuadrado NO cuentan como marca"
5. **Default seguro:** "En caso de DUDA, devuelve NC"
6. **Especificidad por campo:** Sexo tiene instrucciones propias sobre el orden de checkboxes

### 4.2 Errores Comunes de Gemini y Como se Mitigan

| Error | Causa | Mitigacion en el prompt |
|-------|-------|------------------------|
| Alucina "Si" en campos vacios | Confunde borde impreso con marca | "Solo marca CLARA de boligrafo DENTRO del cuadrado" |
| Confunde sexo 1/2 | No sabe el orden de checkboxes | "Mujer=1 aparece primero, luego Hombre=2" |
| Devuelve null | Interpretacion liberal de "no legible" | "NUNCA null, siempre NC" |
| Valoracion 7.x cuando es Presencial | No cruza datos entre paginas | "Si modalidad es Presencial, devuelve NA" |

### 4.3 Evolucion del Prompt

El prompt debe evolucionar basandose en datos reales de correcciones humanas (ver seccion 7).

---

## 5. Campos del Formulario FUNDAE

### 5.1 Pagina 1 — Datos del Participante (11 campos texto + 7 checkbox)

| Campo | Tipo | Valores posibles |
|-------|------|-----------------|
| numero_expediente | texto | "FXXXXXX" o alfanumerico |
| perfil | texto | Letra mayuscula |
| cif_empresa | texto | Letra + 8 digitos |
| numero_accion | texto | 1-5 digitos |
| numero_grupo | texto | 1-4 digitos |
| denominacion_aaff | texto | Nombre del curso |
| edad | texto | 16-99 |
| lugar_trabajo | texto | Provincia espanola |
| otra_titulacion_especificar | texto | Texto libre |
| fecha_cumplimentacion | texto | DD/MM/YYYY |
| sugerencias | texto | Texto libre |
| modalidad | checkbox | Presencial / Teleformacion / Mixta / NC |
| sexo | checkbox | 1 (Mujer) / 2 (Hombre) / 9 (NC) |
| titulacion | checkbox | 1, 11, 111, 12, 2, 21, 3, 4, 41, 42, 5, 6, 6.1, 7, 7.1, 7.3, 7.4, 8, 9, 99 |
| categoria_profesional | checkbox | 1-6, 9 |
| horario_curso | checkbox | 1, 2, 3, 9 |
| porcentaje_jornada | checkbox | 1, 2, 3, 9 |
| tamano_empresa | checkbox | 1-5, 9 |

### 5.2 Pagina 2 — Valoraciones (22 escala + 3 binarios)

| Campo | Tipo | Valores posibles |
|-------|------|-----------------|
| valoracion_1_1 a 6_2 | escala | NC / 1 / 2 / 3 / 4 |
| valoracion_7_1, 7_2 | escala | NC / 1 / 2 / 3 / 4 / NA (si Presencial) |
| valoracion_9_1 a 9_5 | escala | NC / 1 / 2 / 3 / 4 |
| valoracion_10 | escala | NC / 1 / 2 / 3 / 4 |
| valoracion_8_1 | binario | Si / No / NC |
| valoracion_8_2 | binario | Si / No / NC |
| recomendaria_curso | binario | Si / No / NC |

### 5.3 Regla Especial: Formadores y Tutores

Las preguntas 4.1 y 4.2 tienen DOS sub-filas cada una:
- `valoracion_4_1_formadores` — primera sub-fila
- `valoracion_4_1_tutores` — segunda sub-fila
- `valoracion_4_2_formadores` — primera sub-fila
- `valoracion_4_2_tutores` — segunda sub-fila

---

## 6. Infraestructura y Despliegue

### 6.1 Vercel

- **Framework:** Vite + React (frontend) + Serverless Functions (API)
- **maxDuration:** 300 segundos (suficiente para ~58s de Gemini 3 Pro)
- **Body size limit:** 15MB (suficiente para PDFs de formularios)
- **Despliegue:** Push a `main` en GitHub -> deploy automatico

### 6.2 Variables de Entorno

| Variable | Descripcion |
|----------|-------------|
| `GOOGLE_API_KEY` | API key de Google AI (Gemini) |
| `USE_HYBRID_EXTRACTION` | `true` para activar el endpoint |

### 6.3 Repositorio

- **GitHub:** https://github.com/VCNPRO/verbadoc-pruebas
- **Produccion:** https://verbadocpro-pruebas.vercel.app

---

## 7. Estrategia de Mejora Continua

### 7.1 Por Que NO Usar RAG/Vectores/Fine-tuning

Los formularios FUNDAE son documentos estandarizados. Los errores de Gemini son de **vision** (confundir un checkbox vacio con uno marcado), no de **comprension**. Un sistema RAG no mejora la capacidad visual del modelo.

Ademas, en sectores gobierno/salud:
- Los embeddings vectoriales pueden filtrar PII
- Fine-tuning requiere enviar datos reales a Google
- La complejidad de mantenimiento no se justifica

### 7.2 Enfoque Recomendado: Validacion + Patrones + Prompt Evolution

```
Gemini 3 Pro lee formulario
         |
         v
Validacion determinista (reglas fijas)
         |
    +-----------+
    |           |
  Alta        Baja
confianza   confianza
    |           |
    v           v
Automatico  Revision humana
                |
                v
         Correccion guardada
                |
                v
    Tabla de patrones de error
    (campo, valor_gemini, valor_corregido, frecuencia)
                |
                v
    Revision mensual del prompt
```

### 7.3 Capa 1 — Reglas de Validacion Deterministas

Implementar DESPUES de confirmar precision con los 10 formularios de prueba:

| Regla | Accion |
|-------|--------|
| modalidad = "Presencial" y 7.1/7.2 tienen valor numerico | Forzar 7.1/7.2 = "NA" |
| Valoracion fuera de NC/1/2/3/4/NA | Forzar "NC" |
| Binario fuera de Si/No/NC | Forzar "NC" |
| CIF no cumple formato L+8 digitos | Marcar para revision |
| Edad < 16 o > 99 | Marcar para revision |
| Todas las valoraciones NC y 8.1/8.2 = Si | Sospechoso, marcar |
| fecha_cumplimentacion formato invalido | Marcar para revision |

### 7.4 Capa 2 — Tabla de Patrones de Error

Tabla SQL simple (sin PII):

```sql
CREATE TABLE correction_patterns (
  id SERIAL PRIMARY KEY,
  field_name VARCHAR(50),        -- ej: "valoracion_8_1"
  gemini_value VARCHAR(20),      -- ej: "Si"
  corrected_value VARCHAR(20),   -- ej: "NC"
  count INTEGER DEFAULT 1,       -- frecuencia
  last_seen TIMESTAMP,
  model_version VARCHAR(50)      -- ej: "gemini-3-pro-preview"
);
```

Cuando `count` supera un umbral (ej: 10), acciones posibles:
- Bajar confianza automatica de ese campo
- Marcarlo siempre para revision humana
- Anadir instruccion especifica al prompt

### 7.5 Capa 3 — Evolucion del Prompt

Revision mensual basada en la tabla de patrones:
1. Consultar los top 10 patrones de correccion mas frecuentes
2. Para cada uno, evaluar si se puede resolver con una instruccion mas especifica
3. Actualizar el prompt y probar con 10 formularios antes de desplegar
4. Documentar el cambio en esta guia

---

## 8. Decisiones Tecnicas y Lecciones Aprendidas

### 8.1 Enfoques Descartados

#### CV Judge (analisis de pixeles con Sharp)
- **Idea:** Sharp escanea los checkboxes como pixeles oscuros, sin depender de IA
- **Resultado:** 31-78% de precision. Los umbrales de densidad no funcionan con layouts variables, ruido de lineas de tabla, y variantes de formulario
- **Leccion:** Los formularios FUNDAE tienen demasiada variabilidad de layout para coordenadas fijas

#### Gemini Localiza + Sharp Lee
- **Idea:** Gemini da las coordenadas de cada checkbox, Sharp lee la densidad de pixeles
- **Resultado:** Gemini no puede dar bounding boxes precisos de checkboxes de 10x10px. Error sistematico de ~25 unidades en eje X
- **Leccion:** Gemini entiende formularios visualmente pero no puede dar coordenadas de pixel precisas

#### Sharp Column Scanner
- **Idea:** Sharp escanea horizontalmente para encontrar las columnas de checkboxes automaticamente
- **Resultado:** Funcionaba en algunos formularios pero no en otros. Los gaps entre columnas variaban segun el layout
- **Leccion:** El escaneo de pixeles es fragil cuando los layouts cambian

#### Gemini 2.5 Flash para lectura directa
- **Resultado:** Lee bien las valoraciones pero alucina en campos binarios (8.1, 8.2) y confunde sexo
- **Leccion:** La generacion del modelo importa. Gemini 3 resolvio las alucinaciones que 2.5 tenia

### 8.2 Lo Que Funciono

1. **Renderizado a 300 DPI:** Suficiente resolucion para que Gemini lea marcas de boligrafo
2. **Prompt exhaustivo:** Listar los 43 campos con codigos exactos elimina ambiguedad
3. **temperature: 0:** Reduce drasticamente las alucinaciones
4. **Una sola llamada:** Gemini lee todo (texto + checkboxes) en una pasada. Mas simple, mas rapido, mas barato
5. **Gemini 3 Pro:** Salto cualitativo en precision visual respecto a 2.5

---

## 9. Procesamiento Batch (3.500 formularios)

### 9.1 Estrategia (pendiente de implementacion)

Para procesar 3.500 formularios no se puede usar la interfaz web uno a uno. Opciones:

**Opcion A — Script local:**
- Script Node.js que lee PDFs de un directorio
- Llama a `/api/extract-hybrid` para cada uno
- Paralelismo limitado (5-10 simultaneos) para no saturar Gemini API
- Guarda resultados en base de datos
- Tiempo estimado: ~6-12 horas con 5 en paralelo

**Opcion B — Cola de procesamiento:**
- Subir PDFs a almacenamiento (S3/Vercel Blob)
- Cola (Redis/BullMQ) que procesa secuencialmente
- Worker que consume la cola y llama a Gemini
- Dashboard de progreso
- Mas robusto pero mas complejo de montar

### 9.2 Estimaciones

| Concepto | Valor |
|----------|-------|
| Formularios | 3.500 |
| Tiempo por formulario | ~58s |
| Tiempo total secuencial | ~56 horas |
| Tiempo con 5 en paralelo | ~12 horas |
| Tiempo con 10 en paralelo | ~6 horas |
| Coste Gemini 3 Pro | ~$35 |
| Coste Gemini 3 Flash (alternativa) | ~$14 |

### 9.3 Rate Limits de Gemini API

Verificar los limites de la API key:
- Requests per minute (RPM)
- Tokens per minute (TPM)
- Si se exceden, implementar retry con backoff exponencial

---

## 10. Seguridad y Privacidad

### 10.1 Datos PII

Los formularios FUNDAE contienen datos personales:
- Edad, sexo, lugar de trabajo
- CIF de empresa
- Potencialmente: nombre en sugerencias manuscritas

### 10.2 Medidas

| Aspecto | Estado |
|---------|--------|
| Datos enviados a Gemini API | Los datos NO se usan para entrenamiento (API de pago) |
| Almacenamiento de imagenes | No se almacenan las imagenes PNG renderizadas |
| Tabla de correcciones | Solo patrones agregados, sin PII |
| HTTPS | Forzado en Vercel |
| API keys | Variables de entorno, no en codigo |

### 10.3 Para Gobierno/Salud (futuro)

Si se requiere certificacion:
- Migrar a Vertex AI con region europea (eu-west)
- Evaluar procesamiento on-premise para datos sensibles
- Audit log de todos los accesos a datos

---

## 11. Monitoring y Observabilidad

### 11.1 Logs Actuales

Cada extraccion genera logs en Vercel:
```
[hybridExtractor] Renderizando PDF a PNG server-side (300 DPI)...
[hybridExtractor] 2 pagina(s) renderizadas
[hybridExtractor] Gemini (gemini-3-pro-preview) leyendo formulario completo...
[hybridExtractor] Gemini extrajo 43 campos
[hybridExtractor] Completado en 58153ms, confianza: 87.5%
[Gemini] valoracion_1_1: 4
[Gemini] valoracion_1_2: 4
...
```

### 11.2 Metricas a Monitorizar (pendiente)

| Metrica | Objetivo |
|---------|----------|
| Tiempo de procesamiento | < 120s (actual ~58s) |
| Tasa de error de Gemini API | < 1% |
| Tasa de campos corregidos por humanos | < 5% |
| Campos mas corregidos | Identificar para mejorar prompt |
| Coste acumulado Gemini | Tracking mensual |

---

## 12. Roadmap Tecnico

### Fase 1 — Validacion (actual)
- [x] Gemini 3 Pro implementado
- [ ] Probar con 10 formularios reales en produccion
- [ ] Confirmar precision aceptable
- [ ] Identificar campos problematicos restantes

### Fase 2 — Robustez
- [ ] Implementar reglas de validacion deterministas (seccion 7.3)
- [ ] Manejo de errores robusto (retry, timeout)
- [ ] Null -> NC en todos los flujos

### Fase 3 — Batch Processing
- [ ] Script de procesamiento por lotes
- [ ] Paralelismo controlado con rate limiting
- [ ] Dashboard de progreso

### Fase 4 — Mejora Continua
- [ ] Tabla de patrones de correccion
- [ ] Dashboard de metricas de calidad
- [ ] Revision mensual del prompt

### Fase 5 — Produccion Final
- [ ] Migrar de preview a modelo estable cuando este disponible
- [ ] Certificacion de seguridad si es necesario
- [ ] Documentacion de usuario final

---

## 13. Contacto y Referencias

- **Repositorio:** https://github.com/VCNPRO/verbadoc-pruebas
- **Produccion:** https://verbadocpro-pruebas.vercel.app
- **Gemini API Docs:** https://ai.google.dev/gemini-api/docs/models
- **Gemini 3 Pricing:** ~$2-4/1M input tokens (Pro), ~$0.50/1M (Flash)
