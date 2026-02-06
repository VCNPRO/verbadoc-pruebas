# VerbaDoc Pro - Documento de Trabajo Comercial
## Valoracion de Servicios y Dimensionamiento Tecnologico

**Fecha:** Febrero 2026
**Version:** 1.0
**Confidencial - Uso Interno**

---

## 1. RESUMEN EJECUTIVO

VerbaDoc Pro es una plataforma RAG multimodal completa que ofrece:
- Extraccion inteligente de datos de documentos (PDF, imagenes, manuscritos)
- Busqueda semantica y consultas en lenguaje natural
- Procesamiento por lotes a escala empresarial
- Almacenamiento seguro con trazabilidad completa

Este documento proporciona la informacion necesaria para elaborar ofertas comerciales basadas en volumenes de 1.000 a 1.000.000 de documentos.

---

## 2. CAPACIDADES DE VERBADOC PRO

### 2.1 Extraccion de Datos
| Caracteristica | Descripcion |
|----------------|-------------|
| OCR Inteligente | Vision por IA (Gemini 2.0) para PDFs e imagenes |
| HTR Manuscritos | Reconocimiento de escritura a mano historica |
| Campos Estructurados | Checkboxes, fechas, numeros, texto libre |
| Tablas | Extraccion de datos tabulares |
| Validacion | Scoring de confianza por campo (0-100%) |
| Formatos | PDF, JPEG, PNG, TIFF, WebP, GIF, BMP |

### 2.2 RAG Multimodal
| Caracteristica | Descripcion |
|----------------|-------------|
| Ingesta Automatica | Vectorizacion y almacenamiento semantico |
| Busqueda Semantica | Consultas en lenguaje natural |
| Respuestas Contextuales | IA genera respuestas citando fuentes |
| Voz Integrada | Entrada por microfono + lectura de respuestas |
| Carpetas | Organizacion jerarquica de documentos |
| Multiidioma | Soporte ES, EN, CA, FR, DE, IT, PT |

### 2.3 Modulos Funcionales
- **Lote de Documentos**: Carga masiva y procesamiento batch
- **Biblioteca RAG**: Gestion y consulta de documentos ingested
- **Visor Universal**: PDF e imagenes con zoom y navegacion
- **Master Excel**: Exportacion estructurada de datos
- **Lista de Revision**: Workflow de validacion
- **Panel de Consultas**: Interface NLQ con voz

### 2.4 Seguridad y Compliance
- HTTPS obligatorio (HSTS)
- Autenticacion JWT con cookies httpOnly
- CORS restrictivo
- Content Security Policy estricta
- Datos en UE (Vercel EU, Neon EU)
- Preparado para RGPD

---

## 3. STACK TECNOLOGICO

| Componente | Tecnologia | Proveedor |
|------------|------------|-----------|
| Frontend | React + TypeScript | Vercel |
| Backend | Node.js Serverless | Vercel Functions |
| Base de Datos | PostgreSQL + pgvector | Neon |
| Storage | Blob Storage | Vercel Blob |
| IA - Vision/OCR | Gemini 2.0 Flash | Google |
| IA - Embeddings | text-embedding-3-small | OpenAI |
| IA - NLQ | Gemini 2.5 Pro | Google |

---

## 4. ANALISIS DE COSTES POR VOLUMEN

### 4.1 Parametros Base
- **Paginas por documento**: 5 (media asumida)
- **Tamano por documento**: 2 MB (media)
- **Tokens por pagina**: 1.500 (para embeddings)
- **Dimension embeddings**: 1.536

### 4.2 Costes Unitarios (Precios API 2025-2026)

| Servicio | Unidad | Coste |
|----------|--------|-------|
| Gemini 2.0 Flash (input) | 1M tokens | $0.075 |
| Gemini 2.0 Flash (output) | 1M tokens | $0.30 |
| Gemini (imagen/pagina PDF) | por pagina | $0.0011 |
| OpenAI Embeddings 3-small | 1M tokens | $0.02 |
| Vercel Pro | mes | $20 |
| Vercel Blob Storage | GB/mes | $0.023 |
| Vercel Bandwidth | GB | $0.05 |
| Neon Launch | mes | $19 |
| Neon Scale | mes | $69 |
| Neon Storage | GB/mes | $0.35 |

### 4.3 Tabla de Costes por Volumen

#### INGESTA INICIAL (Coste Unico)

| Volumen | Docs | Paginas | Gemini OCR | Embeddings | Total Ingesta |
|---------|------|---------|------------|------------|---------------|
| Tier 1 | 1.000 | 5.000 | $5.50 | $0.15 | **$6** |
| Tier 2 | 10.000 | 50.000 | $55 | $1.50 | **$57** |
| Tier 3 | 50.000 | 250.000 | $275 | $7.50 | **$283** |
| Tier 4 | 100.000 | 500.000 | $550 | $15 | **$565** |
| Tier 5 | 500.000 | 2.500.000 | $2.750 | $75 | **$2.825** |
| Tier 6 | 1.000.000 | 5.000.000 | $5.500 | $150 | **$5.650** |

#### INFRAESTRUCTURA MENSUAL

| Volumen | Storage Blob | Storage DB | Vectores | Infra Base | Total/Mes |
|---------|--------------|------------|----------|------------|-----------|
| Tier 1 | $0.23 (10GB) | Incluido | <1GB | $39 | **$40** |
| Tier 2 | $2.30 (100GB) | Incluido | <1GB | $39 | **$42** |
| Tier 3 | $11.50 (500GB) | $17.50 | 1.5GB | $89 | **$120** |
| Tier 4 | $23 (1TB) | $35 | 3GB | $89 | **$150** |
| Tier 5 | $115 (5TB) | $175 | 15GB | $170 | **$460** |
| Tier 6 | $230 (10TB) | $350 | 30GB | $350 | **$930** |

#### CONSULTAS NLQ (Estimacion por 1.000 consultas/mes)

| Modelo | Coste/1K consultas |
|--------|-------------------|
| Gemini 2.5 Pro (respuestas largas) | $15-25 |
| Gemini 2.0 Flash (respuestas cortas) | $3-5 |
| Busqueda semantica (embeddings) | $0.50 |

---

## 5. COSTE TOTAL DE PROPIEDAD (TCO)

### Escenario: Proyecto Piloto + 12 Meses Operacion

| Volumen | Ingesta | Infra x12 | Consultas x12 | **TCO Anual** |
|---------|---------|-----------|---------------|---------------|
| 1.000 docs | $6 | $480 | $60 | **$546** |
| 10.000 docs | $57 | $504 | $180 | **$741** |
| 50.000 docs | $283 | $1.440 | $360 | **$2.083** |
| 100.000 docs | $565 | $1.800 | $600 | **$2.965** |
| 500.000 docs | $2.825 | $5.520 | $1.200 | **$9.545** |
| 1.000.000 docs | $5.650 | $11.160 | $2.400 | **$19.210** |

---

## 6. BENCHMARKS DE LA INDUSTRIA

### 6.1 Precios de Mercado - Extraccion OCR/IDP

| Proveedor | Modelo | Precio |
|-----------|--------|--------|
| Azure Document Intelligence | Por pagina | $0.0125/pag ($12.50/1K) |
| Google Document AI | Por pagina | $0.01-0.065/pag |
| Amazon Textract (avanzado) | Por pagina | $0.01/pag basico, $0.05 tablas |
| ABBYY | Suscripcion | $199/5K paginas ($0.04/pag) |
| Nanonets | SaaS | $0.03-0.10/pag |
| Rossum | Enterprise | $500+/mes minimo |

### 6.2 Precios de Mercado - RAG Enterprise

| Proveedor | Modelo | Precio |
|-----------|--------|--------|
| Vectara | Enterprise RAG | Custom (desde $500/mes) |
| Nuclia | Growth | $600-1.500/mes |
| LlamaCloud | Credits | $100-500/mes |
| Pinecone + LLM | Infraestructura | $50-500/mes + LLM |

### 6.3 Proyectos Llave en Mano (Espana)

| Tipo | Rango Precio |
|------|--------------|
| MVP/Pilot basico | EUR 15.000-45.000 |
| Solucion completa RAG+NLQ | EUR 40.000-100.000+ |
| Enterprise con integraciones | EUR 100.000-300.000 |

### 6.4 Modelos de Cobro Habituales

1. **Por Pagina**: EUR 0.02-0.15/pagina (segun complejidad)
2. **Por Documento**: EUR 0.10-0.50/documento
3. **Suscripcion**: EUR 500-5.000/mes (volumenes incluidos)
4. **Setup + Consumo**: EUR 10K-50K setup + EUR 0.05-0.10/pagina
5. **Enterprise SaaS**: EUR 1.500-7.000/mes

---

## 7. PROPUESTA DE MODELOS DE PRECIO VERBADOC PRO

### 7.1 Modelo A: Por Consumo (Pay-as-you-go)

| Concepto | Precio Recomendado | Margen |
|----------|-------------------|--------|
| Setup/Onboarding | EUR 2.500-15.000 | -- |
| Ingesta por pagina | EUR 0.03-0.08 | 5-15x |
| Consulta NLQ | EUR 0.02-0.05 | 4-10x |
| Storage/mes | EUR 0.10/GB | 4x |

**Ejemplo 100.000 paginas:**
- Setup: EUR 10.000
- Ingesta: 100K x EUR 0.05 = EUR 5.000
- **Total inicial: EUR 15.000**
- Mantenimiento: EUR 200-500/mes

### 7.2 Modelo B: Suscripcion por Tiers

| Tier | Docs/mes | Consultas/mes | Precio/mes |
|------|----------|---------------|------------|
| Starter | 500 | 1.000 | EUR 299 |
| Business | 5.000 | 10.000 | EUR 899 |
| Professional | 25.000 | 50.000 | EUR 2.499 |
| Enterprise | 100.000+ | Ilimitadas | EUR 5.999+ |

### 7.3 Modelo C: Proyecto + SaaS (Recomendado para Pilots)

**Fase 1 - Pilot (2-3 meses)**
| Volumen | Precio Pilot |
|---------|--------------|
| 1.000 docs | EUR 5.000-8.000 |
| 10.000 docs | EUR 12.000-20.000 |
| 50.000 docs | EUR 25.000-40.000 |
| 100.000 docs | EUR 40.000-60.000 |

**Fase 2 - Produccion (SaaS anual)**
| Volumen | Precio Anual |
|---------|--------------|
| Hasta 10.000 docs | EUR 6.000-12.000 |
| Hasta 50.000 docs | EUR 15.000-30.000 |
| Hasta 100.000 docs | EUR 30.000-50.000 |
| Hasta 500.000 docs | EUR 60.000-100.000 |
| 1.000.000+ docs | Custom |

---

## 8. DIMENSIONAMIENTO TECNOLOGICO

### 8.1 Requisitos por Volumen

| Volumen | Neon Plan | Vector Storage | Tiempo Ingesta* |
|---------|-----------|----------------|-----------------|
| 1.000 | Launch | <1 GB | 2-4 horas |
| 10.000 | Launch | <1 GB | 1-2 dias |
| 50.000 | Scale | 2 GB | 1 semana |
| 100.000 | Scale | 4 GB | 2 semanas |
| 500.000 | Enterprise | 20 GB | 1-2 meses |
| 1.000.000 | Enterprise | 40 GB | 2-3 meses |

*Con procesamiento paralelo optimizado

### 8.2 Arquitectura por Escala

**Hasta 50.000 docs:**
- PostgreSQL + pgvector (Neon)
- Vercel Pro
- Sin cambios de arquitectura

**50.000 - 500.000 docs:**
- Considerar Qdrant Cloud o Pinecone
- Vercel Enterprise o AWS/GCP
- Colas de procesamiento (Redis)

**500.000+ docs:**
- Vector DB dedicado (Qdrant self-hosted)
- Kubernetes o Cloud Run
- Procesamiento distribuido
- CDN para documentos

### 8.3 Alta Disponibilidad y Redundancia

| Nivel | Componentes | Coste Adicional |
|-------|-------------|-----------------|
| Basico | Single region, backups diarios | Incluido |
| Standard | Multi-AZ, backups horarios | +30% |
| Enterprise | Multi-region, HA activo-activo | +80-150% |

---

## 9. COMPARATIVA COMPETITIVA

### VerbaDoc Pro vs Competencia

| Caracteristica | VerbaDoc Pro | Azure Doc Intel | Google Doc AI | ABBYY |
|----------------|--------------|-----------------|---------------|-------|
| OCR PDF | Si | Si | Si | Si |
| OCR Imagenes | Si | Si | Si | Si |
| HTR Manuscritos | Si | No | Limitado | Limitado |
| RAG Integrado | Si | No | No | No |
| NLQ Voz | Si | No | No | No |
| Multimodal | Si | Parcial | Parcial | No |
| Self-service | Si | Si | Si | No |
| Precio 100K pags | ~EUR 5.000 | ~EUR 1.250 | ~EUR 1.500 | ~EUR 4.000 |
| Incluye RAG | Si | No (+$$$) | No (+$$$) | No |

**Ventaja Competitiva**: VerbaDoc Pro incluye RAG+NLQ integrado. Competidores cobran extraccion aparte y requieren integracion adicional para RAG.

---

## 10. RECOMENDACIONES COMERCIALES

### 10.1 Estrategia de Pricing

1. **No competir en precio de OCR puro** - Azure/Google son mas baratos
2. **Vender la solucion completa** - Extraccion + RAG + NLQ
3. **Enfatizar diferenciadores**:
   - HTR para manuscritos
   - Voz integrada
   - Sin desarrollo adicional
   - Operativo en dias, no meses

### 10.2 Segmentos Objetivo

| Segmento | Volumen Tipico | Modelo Recomendado |
|----------|----------------|-------------------|
| PYME | 1.000-10.000 | Suscripcion Starter/Business |
| Corporativo | 10.000-100.000 | Proyecto + SaaS |
| Enterprise | 100.000+ | Custom Enterprise |
| Sector Publico | Variable | Licitacion/Framework |

### 10.3 Margenes Objetivo

| Concepto | Coste | PVP | Margen |
|----------|-------|-----|--------|
| Ingesta/pagina | EUR 0.002-0.005 | EUR 0.03-0.08 | 10-40x |
| Consulta NLQ | EUR 0.005-0.02 | EUR 0.02-0.05 | 2-10x |
| Infraestructura | EUR 40-200/mes | EUR 200-1.000/mes | 5x |
| Servicios profesionales | Coste hora | EUR 80-150/hora | 2-3x |

---

## 11. PLANTILLAS DE OFERTA

### 11.1 Oferta Pilot 100.000 Paginas

```
PROPUESTA COMERCIAL - PILOT VERBADOC PRO

Cliente: [NOMBRE]
Volumen: 100.000 paginas (~20.000 documentos)
Duracion: 3 meses

ALCANCE:
- Ingesta y procesamiento de 100.000 paginas
- Configuracion de carpetas y taxonomia
- Entrenamiento de usuarios (4 horas)
- Soporte tecnico durante pilot
- Acceso a RAG y consultas NLQ ilimitadas

INVERSION:
- Setup y configuracion: EUR 8.000
- Procesamiento documentos: EUR 5.000
- Formacion y soporte: EUR 2.000
- TOTAL PILOT: EUR 15.000 + IVA

EVOLUCION POST-PILOT:
- Suscripcion anual Professional: EUR 2.499/mes
- Incluye: 25.000 docs/mes, consultas ilimitadas
```

### 11.2 Oferta Enterprise 500.000+ Paginas

```
PROPUESTA COMERCIAL - ENTERPRISE VERBADOC PRO

Cliente: [NOMBRE]
Volumen: 500.000 paginas iniciales + crecimiento

FASE 1 - IMPLEMENTACION (3 meses):
- Analisis y diseno de solucion
- Ingesta inicial 500.000 paginas
- Integraciones API (si aplica)
- Formacion equipo (16 horas)
- Inversion: EUR 45.000-60.000

FASE 2 - OPERACION (anual):
- Suscripcion Enterprise
- SLA 99.5%
- Soporte prioritario
- Inversion: EUR 5.000-8.000/mes

OPCIONALES:
- Hosting dedicado EU: +EUR 500/mes
- Backup geografico: +EUR 300/mes
- Integracion SSO/LDAP: EUR 3.000
```

---

## 12. FUENTES Y REFERENCIAS

### Precios API (Enero 2026)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI Embeddings Pricing](https://platform.openai.com/docs/pricing)
- [Vercel Pricing](https://vercel.com/pricing)
- [Neon Pricing](https://neon.com/pricing)

### Benchmarks Industria
- [Azure Document Intelligence Pricing](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/)
- [Google Document AI Pricing](https://cloud.google.com/document-ai/pricing)
- [RAG as a Service Market Report](https://www.intelmarketresearch.com/rag-as-a-service-2025-2032-715-5161)

### Comparativas
- [LLM API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- [Vector Database Comparison 2025](https://tensorblue.com/blog/vector-database-comparison-pinecone-weaviate-qdrant-milvus-2025)

---

*Documento generado para uso interno. Precios sujetos a variacion segun condiciones de mercado y proveedores.*
