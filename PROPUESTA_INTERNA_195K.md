# PROPUESTA ECONÓMICA INTERNA
## Proyecto de Digitalización y Biblioteca Inteligente RAG
### DOCUMENTO CONFIDENCIAL - USO INTERNO

**Fecha:** 9 de febrero de 2026
**Empresa:** VerbadocPro Europa
**Referencia:** PROP-2026-001

---

## 1. DESCRIPCIÓN DEL PROYECTO

Servicio integral de digitalización, transcripción con IA y puesta en marcha de una Biblioteca RAG Inteligente para un cliente final a través de un partner/revendedor.

**Servicios incluidos:**
- Transcripción completa con IA (Gemini) de 195,000 páginas en 48,000 documentos
- Entrega de todas las transcripciones en formato **JSON**
- Ingesta en **Biblioteca RAG** con búsqueda por lenguaje natural y voz
- Acceso a plataforma web para **10-20 usuarios** durante **12 meses** (mínimo 6)
- Retención de datos en infraestructura propia: **12 meses mínimo**
- Descarga de documentos originales desde la plataforma
- Soporte técnico durante toda la vigencia del contrato

---

## 2. MATERIAL A PROCESAR

| Tipo de documento         | % del total | Páginas  | Documentos (est.) |
|---------------------------|-------------|----------|--------------------|
| Caligrafía y manuscritos  | ~40%        | 78,000   | ~19,500            |
| Máquina de escribir       | ~35%        | 68,250   | ~17,063            |
| Planos técnicos (DIN A4)  | ~20%        | 39,000   | ~9,750             |
| Fotografías               | ~5%         | 9,750    | ~2,437             |
| **TOTAL**                 | **100%**    | **195,000** | **48,750 (aprox 48,000)** |

**Nota:** El 95% del material es de alta complejidad (caligrafía, máquina de escribir y planos técnicos). Los planos representan un 20% del total y están en formato DIN A4.

---

## 3. TARIFAS DE MERCADO (PVP CLIENTE FINAL)

Tarifas competitivas de mercado europeo para servicios de transcripción IA + plataforma RAG:

| Concepto                              | Unidades      | €/unidad   | Subtotal    |
|---------------------------------------|---------------|------------|-------------|
| Transcripción caligrafía/manuscritos  | 78,000 págs   | €0.28      | €21,840     |
| Transcripción máquina de escribir     | 68,250 págs   | €0.15      | €10,238     |
| Procesamiento planos técnicos A4      | 39,000 págs   | €0.85      | €33,150     |
| Procesamiento fotografías             | 9,750 págs    | €0.18      | €1,755      |
| **Subtotal procesamiento**            | **195,000**   | **€0.34 media** | **€66,983** |
| Setup y configuración plataforma RAG  | 1             | €3,500     | €3,500      |
| Plataforma + 20 usuarios (12 meses)  | 12 meses      | €450/mes   | €5,400      |
| Almacenamiento y retención de datos   | 12 meses      | incluido   | —           |
| **TOTAL PVP MERCADO**                 |               |            | **€75,883** |

---

## 4. ESTRUCTURA DE PRECIOS REVENDEDOR

El revendedor compra a precio reducido y vende al cliente final a tarifa de mercado. Su margen es del 30% al 40%.

### Opción A — Margen revendedor 30%

| Concepto                  | PVP mercado | Precio revendedor |
|---------------------------|-------------|-------------------|
| Procesamiento documentos  | €66,983     | €46,888           |
| Setup plataforma          | €3,500      | €2,450            |
| Plataforma 12 meses      | €5,400      | €3,780            |
| **TOTAL**                 | **€75,883** | **€53,118**       |
| **Margen revendedor**     |             | **€22,765 (30%)** |

### Opción B — Margen revendedor 35% (RECOMENDADA)

| Concepto                  | PVP mercado | Precio revendedor |
|---------------------------|-------------|-------------------|
| Procesamiento documentos  | €66,983     | €43,539           |
| Setup plataforma          | €3,500      | €2,275            |
| Plataforma 12 meses      | €5,400      | €3,510            |
| **TOTAL**                 | **€75,883** | **€49,324**       |
| **Margen revendedor**     |             | **€26,559 (35%)** |

### Opción C — Margen revendedor 40%

| Concepto                  | PVP mercado | Precio revendedor |
|---------------------------|-------------|-------------------|
| Procesamiento documentos  | €66,983     | €40,190           |
| Setup plataforma          | €3,500      | €2,100            |
| Plataforma 12 meses      | €5,400      | €3,240            |
| **TOTAL**                 | **€75,883** | **€45,530**       |
| **Margen revendedor**     |             | **€30,353 (40%)** |

---

## 5. COSTES DE PRODUCCIÓN (NUESTROS COSTES REALES)

| Concepto                                   | Mínimo   | Máximo   |
|--------------------------------------------|----------|----------|
| API Gemini — transcripción 195K páginas    | €850     | €1,250   |
| Embeddings — vectorización RAG             | €10      | €25      |
| Almacenamiento Vercel Blob (12 meses)      | €185     | €260     |
| Base de datos PostgreSQL + pgvector (12 m) | €600     | €1,200   |
| Hosting Vercel Pro (12 meses)              | €240     | €480     |
| Consultas RAG volumen alto (12 meses)      | €200     | €600     |
| Mano de obra, supervisión y QA             | €3,000   | €5,000   |
| Contingencia (10%)                         | €510     | €900     |
| **TOTAL COSTE PRODUCCIÓN**                 | **€5,595** | **€9,715** |

---

## 6. ANÁLISIS DE RENTABILIDAD

### Con margen 30% para revendedor (nuestro precio: €53,118)

| Escenario     | Ingreso  | Coste prod. | Beneficio bruto | Margen neto |
|---------------|----------|-------------|-----------------|-------------|
| Pesimista     | €53,118  | €9,715      | **€43,403**     | 81.7%       |
| Realista      | €53,118  | €7,500      | **€45,618**     | 85.9%       |
| Optimista     | €53,118  | €5,595      | **€47,523**     | 89.5%       |

### Con margen 35% para revendedor (nuestro precio: €49,324)

| Escenario     | Ingreso  | Coste prod. | Beneficio bruto | Margen neto |
|---------------|----------|-------------|-----------------|-------------|
| Pesimista     | €49,324  | €9,715      | **€39,609**     | 80.3%       |
| Realista      | €49,324  | €7,500      | **€41,824**     | 84.8%       |
| Optimista     | €49,324  | €5,595      | **€43,729**     | 88.7%       |

### Con margen 40% para revendedor (nuestro precio: €45,530)

| Escenario     | Ingreso  | Coste prod. | Beneficio bruto | Margen neto |
|---------------|----------|-------------|-----------------|-------------|
| Pesimista     | €45,530  | €9,715      | **€35,815**     | 78.7%       |
| Realista      | €45,530  | €7,500      | **€38,030**     | 83.5%       |
| Optimista     | €45,530  | €5,595      | **€39,935**     | 87.7%       |

---

## 7. PLANIFICACIÓN DE ENTREGA

| Fase | Semanas | Páginas procesadas | Acumulado | Descripción |
|------|---------|-------------------|-----------|-------------|
| 1. Setup + piloto | 1-2 | 1,000 | 0.5% | Configuración, pruebas de calidad con muestra |
| 2. Lote 1 | 3-6 | 48,750 | 25% | Primer lote de documentos |
| 3. Lote 2 | 7-10 | 48,750 | 50% | Segundo lote |
| 4. Lote 3 | 11-14 | 48,750 | 75% | Tercer lote |
| 5. Lote 4 | 15-18 | 48,750 | 100% | Lote final |
| 6. QA global | 19-20 | — | — | Revisión de calidad global y ajustes |
| 7. Entrega + formación | 21 | — | — | Entrega JSON, formación usuarios |

**Plazo total estimado: 5 meses**

---

## 8. CONDICIONES GENERALES

**Forma de pago:**
- 30% a la firma del contrato
- 23,3% al completar Lote 1 (25% del material)
- 23,3% al completar Lote 2 (50% del material)
- 23,4% al completar Lote 4 (100% del material)

**Garantía de calidad:**
- Precisión transcripción caligrafía: >90%
- Precisión transcripción mecanografiada: >95%
- Precisión procesamiento planos: >85%
- Precisión procesamiento fotografías: >90%

**Plataforma:**
- Disponibilidad (SLA): 99,5%
- Usuarios simultáneos incluidos: hasta 20
- Retención de datos: mínimo 12 meses desde entrega final
- Búsqueda por lenguaje natural (texto) y por voz

**Soporte:**
- Canal: email y sistema de tickets
- Tiempo de respuesta: <24 horas laborables
- Incluido durante toda la vigencia del contrato

---

## 9. RESUMEN EJECUTIVO

| Concepto | Valor |
|---|---|
| Total páginas | **195,000** |
| Total documentos | **48,000** |
| PVP mercado (cliente final) | **€75,883** |
| Precio revendedor (margen 35%) | **€49,324** |
| Margen del revendedor | **€26,559** |
| Nuestro coste de producción | **€5,595 — €9,715** |
| Nuestro beneficio bruto (escenario medio) | **€41,824** |
| Nuestro margen neto (escenario medio) | **84,8%** |
| Precio medio por página (mercado) | **€0.34** |
| Precio medio por página (revendedor) | **€0.22** |
| Plazo de entrega | **5 meses** |

---

## 10. NOTAS INTERNAS

- Los costes de producción son extremadamente bajos gracias al procesamiento 100% automatizado con IA (Gemini API)
- El grueso del coste real es mano de obra de supervisión/QA, no infraestructura
- Hay margen para negociar hasta un 40% al partner sin comprometer rentabilidad
- A partir de 40% de margen para el partner, seguimos teniendo >78% de margen neto
- La infraestructura (Vercel + Neon + Gemini) escala linealmente y sin sorpresas
- El procesamiento 100% en Europa cumple con GDPR y requisitos de soberanía de datos

---

*Documento generado el 9 de febrero de 2026 — VerbadocPro Europa — CONFIDENCIAL*
