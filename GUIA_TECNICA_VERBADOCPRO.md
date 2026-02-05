# ♚ Guía Maestra de VerbadocPro

Este documento es la fuente central de conocimiento para la aplicación VerbadocPro. Está dividido en dos secciones principales: una guía de usuario para operadores y una guía de arquitectura técnica para desarrolladores.

---
---

# Parte 1: 📘 Guía de Usuario - Extractor de Datos Profesional

## 🎯 ¿Qué es esta herramienta?

**Extractor de Datos Profesional** es una aplicación web que te ayuda a extraer información de documentos (PDFs, imágenes, textos) de forma automática usando Inteligencia Artificial.

**En palabras simples:** Subes un documento (como una factura, contrato o formulario), le dices qué información quieres sacar, y la herramienta te devuelve esa información organizada en formato de tabla que puedes descargar en Excel o CSV.

---

## 📚 Conceptos Básicos (para principiantes)

Antes de empezar, es importante entender algunos términos:

### ¿Qué es un "Esquema"?
Un **esquema** es como una plantilla que define qué datos quieres extraer. Por ejemplo:
- Nombre del cliente
- Fecha de factura
- Total a pagar

### ¿Qué es un "Prompt"?
Un **prompt** es la instrucción que le das a la IA. Es como pedirle a alguien que haga algo. Por ejemplo:
> "Extrae el nombre del cliente, la fecha y el total de esta factura"

### ¿Qué es JSON, CSV y Excel?
- **JSON**: Formato de datos que usa la computadora (lo verás en pantalla)
- **CSV**: Archivo de texto que puedes abrir en Excel como tabla
- **Excel**: Archivo .xls que se abre directamente en Microsoft Excel

---

## 🚀 Guía Paso a Paso - Tu Primera Extracción

### Paso 1: Abrir la Aplicación

1. Abre tu navegador web (Chrome, Firefox, Edge)
2. Ve a: `https://extractor-de-datos-profesional.vercel.app`
3. Verás una pantalla con 4 secciones:
   - **Izquierda (Plantillas)**: Plantillas predefinidas
   - **Centro-Izquierda (Lote de Documentos)**: Tus archivos subidos
   - **Centro (Editor)**: Donde configuras la extracción
   - **Derecha (Historial)**: Extracciones anteriores

---

### Paso 2: Subir tus Documentos

#### Opción A: Arrastra y Suelta
1. Encuentra tu archivo en tu computadora (PDF, imagen, etc.)
2. **Arrastra** el archivo hasta el cuadro que dice "Haga clic para subir o arrastre y suelte"
3. Suelta el archivo

#### Opción B: Hacer Clic y Seleccionar
1. Haz clic en el cuadro "Haga clic para subir"
2. Se abrirá una ventana de tu computadora
3. Busca y selecciona tu archivo
4. Haz clic en "Abrir"

**💡 Tip:** Puedes subir varios archivos a la vez si son similares (por ejemplo, 10 facturas del mismo formato)

---

### Paso 3: Ver tu Documento (Opcional)

Si quieres revisar el contenido del documento antes de extraer:

1. En la lista de archivos, busca el icono del **ojo** 👁️ al lado de tu archivo
2. Haz clic en el icono
3. Se abrirá una ventana grande mostrando el documento
4. Revisa el contenido
5. Haz clic en la **X** para cerrar

---

### Paso 4: Usar un Ejemplo (Recomendado para principiantes)

Si es tu primera vez, usa el ejemplo incluido:

1. Haz clic en **"Usar Ejemplo"** (botón con estrella ✨) en la parte superior del editor
2. Haz clic en **"Usar Ejemplo"** en el archivo de ejemplo
3. Verás que se llenan automáticamente:
   - El **Prompt** (instrucción)
   - El **Esquema** (estructura de datos)

**¡Ahora puedes practicar con datos de ejemplo!**

---

### Paso 5: Definir el Prompt (Instrucción)

El **prompt** es lo que le pides a la IA. Debe ser claro y específico.

#### Ejemplo de Buenos Prompts:

```
✅ BUENO: "Extrae el nombre completo del cliente, fecha de la factura, lista de productos comprados y el total a pagar"

❌ MALO: "Dame todo"
❌ MALO: "Info de la factura"
```

#### Consejos para escribir un buen prompt:
- Sé específico sobre QUÉ quieres extraer
- Menciona los nombres exactos de los campos
- Si hay listas (como productos), menciona "lista de..."
- Usa lenguaje natural, como si hablaras con alguien

---

### Paso 6: Definir el Esquema (Estructura de Datos)

El **esquema** es la estructura que tendrán tus datos extraídos.

#### Tipos de Campos Disponibles:

| Tipo | ¿Cuándo usarlo? | Ejemplo |
|------|-----------------|---------|
| **STRING** | Texto normal | Nombre, Dirección, Email |
| **NUMBER** | Números | Precio, Cantidad, Total |
| **BOOLEAN** | Sí/No, Verdadero/Falso | ¿Pagado?, ¿Activo? |
| **ARRAY_OF_STRINGS** | Lista de textos | Lista de categorías |
| **OBJECT** | Grupo de campos | Dirección completa (calle, ciudad, CP) |
| **ARRAY_OF_OBJECTS** | Lista de grupos | Lista de productos (cada uno con nombre y precio) |

#### Cómo Agregar Campos:

1. Escribe el **nombre del campo** (sin espacios, usa guión bajo `_`)
2. Selecciona el **tipo** del desplegable
3. Si necesitas más campos, haz clic en el botón **"+"** verde
4. Si te equivocaste, haz clic en el botón **"🗑️"** rojo para eliminar

---

### Paso 7: Ejecutar la Extracción

1. Revisa que todo esté correcto.
2. Haz clic en el botón azul grande: **"Ejecutar Extracción"**
3. Espera mientras dice "Extrayendo Datos...".
4. Cuando termine, verás los resultados abajo en formato JSON.

---

### Paso 8: Exportar los Datos

1. Busca los botones de exportación arriba de los resultados:
   - **JSON** (azul)
   - **CSV** (verde)
   - **Excel** (verde esmeralda)
2. Haz clic en el formato que prefieras y el archivo se descargará.

---

## 🔄 Procesamiento en Lote (Múltiples Documentos)

1. **Sube todos los archivos** a la vez.
2. **Configura el prompt y el esquema** para el primer archivo.
3. **Procesa el primero** para verificar que funciona.
4. Si está correcto, haz clic en **"Procesar Todos"**.
5. La aplicación procesará todos los archivos automáticamente.

---

## 💾 Usar Plantillas

Las plantillas son configuraciones guardadas para tipos comunes de documentos (Facturas, Formularios, etc.).

1. Haz clic en la plantilla del panel izquierdo.
2. El prompt y esquema se cargarán automáticamente.
3. Ejecuta la extracción.

---

## 🔍 Historial de Extracciones

El historial guarda tus últimas extracciones. Para re-cargar una configuración anterior, ve al panel derecho **"Historial"** y haz clic en el icono de **"↻ Replay"**.

---

## ❓ Solución de Problemas Comunes

- **"El esquema está vacío"**: Agrega al menos un campo al esquema.
- **"Error de la API de Gemini"**: Recarga la página (F5) e intenta de nuevo.
- **"Los datos extraídos están incorrectos"**: Mejora tu prompt para que sea más específico.
- **"No puedo abrir el archivo CSV en Excel"**: Usa el botón "Excel" o importa el CSV en Excel seleccionando el delimitador "Coma" y la codificación "UTF-8".
- **"El documento no se ve en el visor"**: Asegúrate de que es un formato soportado (PDF, JPG, PNG, TIFF).

---
---

# Parte 2: 🛠️ Arquitectura y Guía Técnica

Esta sección detalla la arquitectura del sistema y las especificaciones de implementación para desarrolladores.

## 1. Arquitectura del Flujo IDP (Intelligent Document Processing)

Este es el flujo de procesamiento avanzado para documentos, diseñado para ser un sistema "Zero-Touch".

### Capa 1: Clasificación de Plantilla (IA)
- **Función:** Identificar automáticamente el tipo de documento.
- **Proceso:** El sistema compara una imagen del documento con un repositorio de plantillas definidas.
- **Resultado:** Si se encuentra una plantilla con alta confianza, el documento avanza. Si no, se envía a **Revisión Manual**.

### Capa 2: Recalibración de Coordenadas (IA)
- **Función:** Corregir desviaciones del escaneo (rotación, escala).
- **Proceso:** Se identifican "anclas visuales" (logos, títulos) en el documento para ajustar dinámicamente las coordenadas de los campos de la plantilla maestra, "enderezando virtualmente" el documento.
- **Resultado:** Coordenadas de alta precisión adaptadas a cada documento.

### Capa 3: Extracción Híbrida (Campo por Campo)
- **Función:** Extraer datos de la forma más eficiente y precisa.
- **Proceso:**
    1.  **Intento Rápido (OCR por Coordenadas):** Se usa un OCR simple en la coordenada precisa del campo.
    2.  **Intento Preciso (IA Multimodal):** Si la confianza del OCR es baja, se recorta la imagen de ese campo y se usa un modelo de IA multimodal con un prompt especializado para máxima fiabilidad.

### Capa 4: Validación y Decisión Final
- **Función:** Asignar un estado final al documento.
- **Proceso:** Se ensambla el JSON final, se calcula una puntuación de confianza general y se ejecutan validaciones de lógica de negocio.
- **Resultado:**
    - **Válido:** Si la confianza es alta y no hay errores, se marca como `valid`.
    - **Requiere Revisión:** Si la confianza es baja o hay errores, se marca como `needs_review`.

## 2. Arquitectura Multimodal (Voz)

### 2.1. Entrada de Voz (Speech-to-Text)
- **Tecnología:** `Web Speech API`.
- **Implementación:** Un hook de React (`useVoiceRecognition`) captura la voz del usuario en el cliente. El texto transcrito se usa como consulta para el sistema RAG.

### 2.2. Respuesta por Voz (Text-to-Speech)
- **Tecnología:** API de **Google Cloud Text-to-Speech**.
- **Implementación:** La generación de audio se centraliza en el backend para aprovechar la alta calidad de las voces neuronales.

### 2.3. Gestión de Latencia
- **Estrategia:** Modelo de **respuesta en dos fases**.
  1.  **Fase 1 (Texto Inmediato):** El backend devuelve la respuesta de Gemini como un `StreamingTextResponse`.
  2.  **Fase 2 (Audio Asíncrono):** Una vez completado el texto, el frontend realiza una segunda llamada a un nuevo endpoint (`/api/tts/synthesize`) para obtener el audio.

### 2.4. Ingeniería de Prompts (Persona "Verba")
- **Estrategia:** Se redefine el `prompt de sistema` de Gemini para crear la persona de **"Verba"**, una narradora de historias, con instrucciones estrictas sobre el estilo y formato de la respuesta.

## 3. Gestión de Archivos y Flujos de Curación

### 3.1. Subida de Archivos con Vercel Blob (Presigned URLs)
- **Problema Solucionado:** Error `413 Content Too Large`.
- **Arquitectura:** Se implementa un flujo de URL prefirmada donde el frontend sube el archivo directamente a Vercel Blob, evitando los límites de tamaño de las funciones serverless.
- **Implementación:** Se utiliza la librería `@vercel/blob` y un endpoint `/api/files/upload` que gestiona el proceso.

### 3.2. Lógica de Ingesta RAG
- **Implementación:** La lógica de procesamiento RAG se ejecuta en el callback `onUploadCompleted` del endpoint de subida.
- **Flujo Automático:**
  1.  Tras la subida, el servidor descarga el archivo desde la URL de Vercel Blob.
  2.  Se procesa con el modelo `gemini-pro-vision` para análisis visual y OCR.
  3.  El texto extraído y los metadatos se guardan en Vercel Postgres.

### 3.3. Creación de Carpetas
- **Lógica:** Un endpoint `POST /api/folders/create` gestiona la creación de carpetas, validando duplicados y actualizando la base de datos, que debe tener una estructura jerárquica (`parentId`).

### 3.4. Visor de Verificación de Datos IA
- **Objetivo:** Permitir la curación manual de los datos extraídos por la IA.
- **Interfaz:** Vista de dos paneles (visor de imagen a la izquierda, datos extraídos a la derecha).
- **Flujo:** El usuario puede **"Aprobar"** los datos (cambia el estado a `approved`) o **"Editar"** y guardar, lo cual también actualiza el estado a `approved`. La base de datos requiere una columna `status` (`'pending_review'`, `'approved'`).

## 4. Debugging y Solución de Errores Comunes

- **Error 429: Resource Exhausted:**
    -   **Causa:** Límite de tasa de la API de Gemini excedido.
    -   **Solución:** Revisar cuotas en Google Cloud Console e implementar reintentos con espera exponencial.
- **Error 500: Internal Server Error:**
    -   **Causa:** Error en el código del backend.
    -   **Solución:** Revisar los logs de la función correspondiente en el dashboard de Vercel.
- **Error CSP (Content Security Policy):**
    -   **Causa:** La política de seguridad no permite cargar imágenes desde un dominio externo.
    -   **Solución:** Añadir el dominio a la directiva `img-src` de la CSP en `next.config.js`.