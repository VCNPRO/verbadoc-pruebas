# VerbadocPro - Buenas Practicas de Informacion Publica

**Documento interno** | VideoConversion Digital Lab SL | Febrero 2026 | v1.0

---

## Proposito

Este documento define que informacion se puede compartir publicamente (guias de usuario, dossiers comerciales, presentaciones, web) y que informacion es **confidencial** y no debe aparecer en ningun material externo.

---

## 1. INFORMACION QUE SI SE PUEDE COMPARTIR

### 1.1 Sobre la plataforma
- Nombre comercial: **VerbadocPro**
- Descripcion general: Plataforma de orquestacion documental con IA
- Que es una solucion europea, con infraestructura 100% en la UE
- Que cumple RGPD y ENS (Esquema Nacional de Seguridad)
- Que es propiedad de VideoConversion Digital Lab SL

### 1.2 Capacidades funcionales (en lenguaje de usuario)
- Extraccion inteligente de datos de documentos (PDF, imagenes, audio)
- Procesamiento por lotes de grandes volumenes
- Biblioteca documental con consulta por lenguaje natural
- Validacion automatica de datos extraidos
- Exportacion a Excel, CSV, PDF
- Soporte multiidioma (9 idiomas europeos)
- Reconocimiento de escritura manuscrita (HTR)
- Transcripcion de audio a texto
- Deteccion de codigos QR y de barras
- Asistente virtual Laia para soporte al usuario
- Consulta por voz (Speech-to-Text y Text-to-Speech)
- Gestion de carpetas y organizacion documental
- Sistema de roles y permisos (usuario, revisor, administrador)

### 1.3 Terminologia publica (usar SIEMPRE estos nombres)

| Termino tecnico interno | Nombre publico |
|------------------------|----------------|
| Gemini 2.0 Flash | Motor Estandar (Agilidad) |
| Gemini 2.5 Flash Preview | Motor Avanzado (Equilibrado) |
| Gemini 1.5 Pro | Motor de Alta Densidad (Precision) |
| Top K | Profundidad de Contexto |
| Similarity Threshold | Rigurosidad de Hallazgo |
| Temperature | Indice de Creatividad |
| RAG (Retrieval-Augmented Generation) | Consulta Inteligente / Biblioteca Inteligente |
| Embeddings / Vectores | Indexacion semantica |
| Chunks | Fragmentos de analisis |
| pgvector / Pinecone | Motor de busqueda semantica |
| Serverless Functions | Infraestructura escalable |
| Vercel / Neon | Plataforma cloud europea |
| JWT / bcrypt | Sistema de autenticacion segura |
| API REST | Integraciones empresariales |

### 1.4 Cifras que se pueden mencionar
- Volumenes procesados: "miles", "decenas de miles", "cientos de miles" de documentos
- Velocidad: "segundos por documento" (sin cifras exactas de ms)
- Precision: "superior al 95%" para documentos digitales
- Idiomas: 9 idiomas europeos
- Disponibilidad: 99.9% uptime
- Soporte: respuesta maxima en 24h laborables
- Backups: diarios y automaticos

### 1.5 Sectores y casos de uso
- Administraciones publicas
- Formacion bonificada (FUNDAE)
- Recursos humanos
- Contabilidad y facturacion
- Sanidad y farmacia
- Logistica y almacen
- Archivos historicos y fondos documentales
- Despachos profesionales (abogados, gestores)

---

## 2. INFORMACION QUE NO SE DEBE COMPARTIR

### 2.1 Arquitectura tecnica (NUNCA revelar)
- Nombres de servicios cloud especificos: Vercel, Neon, Pinecone, Google Cloud
- Nombres de modelos de IA especificos: Gemini, Vertex AI, Google GenAI
- Estructura de base de datos: tablas, columnas, esquemas SQL
- Endpoints de API: rutas, parametros, formatos de request/response
- Dimensiones de embeddings (768, etc.)
- Algoritmos de chunking, overlap, tamano de chunks
- Configuracion de CORS, CSP, headers de seguridad
- Estructura de directorios del codigo fuente
- Dependencias y librerias usadas (package.json)
- Variables de entorno y configuracion de deploy
- Flujos de CI/CD y pipelines de despliegue

### 2.2 Datos internos de negocio (NUNCA revelar)
- Costes reales de API por documento
- Margenes de beneficio
- Estructura de costes de produccion
- Precios de coste de infraestructura
- Numero exacto de clientes o usuarios
- Datos de facturacion internos
- Acuerdos comerciales con proveedores de IA

### 2.3 Datos de seguridad (NUNCA revelar)
- Algoritmos de hash de contrasenas (bcrypt rounds)
- Configuracion JWT (duracion tokens, secretos)
- Estructura de logs de auditoria
- Detalles de implementacion de RLS (Row Level Security)
- Configuracion de rate limiting
- Vulnerabilidades conocidas o mitigadas

---

## 3. REGLAS DE REDACCION PARA MATERIAL PUBLICO

### 3.1 Tono y estilo
- **Profesional pero accesible**: evitar jerga tecnica innecesaria
- **Orientado al beneficio**: no describir como funciona, sino que consigue el usuario
- **Confianza**: transmitir seguridad, cumplimiento normativo, respaldo europeo
- **Sin promesas excesivas**: no garantizar resultados especificos sin base

### 3.2 Estructura recomendada
- Titulos descriptivos y claros
- Tablas para comparativas
- Listas numeradas para pasos
- Recuadros para tips y advertencias
- Siempre incluir pie: "VideoConversion Digital Lab SL | Documentacion Confidencial"

### 3.3 Marca
- Nombre: **VerbadocPro** (siempre junto, V y P mayusculas)
- Slogan: "Tecnologia de Orquestacion Documental Propietaria"
- Empresa: VideoConversion Digital Lab SL
- Dominio: verbadocpro.eu
- Infraestructura: "100% Europea"
- Cumplimiento: "RGPD y ENS"

---

## 4. CHECKLIST ANTES DE PUBLICAR

Antes de compartir cualquier documento externo, verificar:

- [ ] No contiene nombres de proveedores cloud ni modelos de IA
- [ ] Usa la terminologia publica (tabla seccion 1.3)
- [ ] No contiene endpoints, rutas de API ni parametros tecnicos
- [ ] No contiene estructuras de base de datos ni SQL
- [ ] No contiene precios de coste ni margenes
- [ ] Incluye pie de pagina con marca y confidencialidad
- [ ] El tono es profesional y orientado al usuario/beneficio
- [ ] Las cifras mencionadas son verificables y no exageradas

---

*VideoConversion Digital Lab SL | Documento Interno | No distribuir externamente*
