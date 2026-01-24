# Arquitectura del Nuevo Flujo de Procesamiento Inteligente de Documentos (IDP)

## 1. Objetivo

El objetivo de esta integración es evolucionar el sistema `verbadoc-pruebas` para incorporar una lógica de procesamiento de documentos más precisa, robusta y automatizada, basándose en los conceptos del prototipo "IDP". Se busca crear un flujo de trabajo "Zero-Touch" donde el sistema tome decisiones inteligentes en cada paso, minimizando la intervención manual y maximizando la fiabilidad de los datos extraídos.

---

## 2. El Flujo de Procesamiento (Paso a Paso)

Cuando un usuario sube un lote de documentos, cada archivo pasará individualmente por el siguiente flujo de 4 capas:

### Capa 1: Clasificación de Plantilla (IA)

- **Función:** Identificar automáticamente el tipo de documento.
- **Proceso:** El sistema toma una imagen general del documento y utiliza un modelo de IA para compararla con un repositorio de "Plantillas" previamente definidas (ej: "Factura Modelo A", "Formulario de Alta B").
- **Resultado:**
    - **Éxito:** Si la IA encuentra una plantilla con un alto grado de confianza, el documento pasa a la siguiente capa.
    - **Fallo:** Si la IA no reconoce el tipo de documento o la confianza es muy baja, el proceso para este archivo se detiene y se envía directamente a la cola de **Revisión Manual** con el motivo "Tipo de documento no reconocido".

### Capa 2: Recalibración de Coordenadas (IA)

- **Función:** Corregir desviaciones del escaneo (rotación, escala, márgenes).
- **Proceso:** Una vez identificada la plantilla, el sistema carga sus coordenadas "maestras". Luego, utiliza la IA para encontrar "anclas visuales" en el documento escaneado (como esquinas, logos o títulos) y ajusta dinámicamente todas las coordenadas de los campos para que encajen perfectamente con la imagen actual. Es un proceso de "enderezado virtual".
- **Resultado:** Un conjunto de coordenadas de alta precisión, adaptadas a cada documento individual.

### Capa 3: Extracción Híbrida (Campo por Campo)

- **Función:** Extraer el dato de cada campo de la forma más eficiente y precisa posible.
- **Proceso:** En lugar de analizar todo el documento de una vez, el sistema recorre cada campo (definido por las coordenadas recalibradas de la Capa 2) de forma individual.
    1.  **Intento Rápido (OCR por Coordenadas):** Se utiliza un motor de OCR simple y rápido para leer el texto o verificar la marca en la casilla dentro de la coordenada precisa. Este método es muy eficiente y se espera que tenga éxito en la mayoría de los casos.
    2.  **Intento Preciso (IA Multimodal Específica):** Si la confianza del OCR rápido es baja para un campo concreto (ej: texto borroso, marca de casilla ambigua), y solo para ese campo, el sistema recurre al modelo de IA multimodal. Se utiliza una imagen recortada de esa pequeña región y un prompt especializado (ej: `VISIÓN CRÍTICA: ... Responde "[X]" o "[ ]"`) para obtener un resultado de máxima fiabilidad.

### Capa 4: Validación y Decisión Final

- **Función:** Asignar un estado final al documento y asegurar la calidad de los datos.
- **Proceso:**
    1.  Se ensambla el JSON final con todos los datos extraídos en la Capa 3.
    2.  Se calcula una **puntuación de confianza general** para el documento, basada en cuántos campos necesitaron la IA y la certeza de cada extracción.
    3.  Se ejecutan validaciones de lógica de negocio (ej: comprobar si una fecha es válida, si un NIF tiene el formato correcto, etc.).
- **Resultado (Decisión Clave):**
    - **Válido:** Si la confianza general es **alta** y no hay errores críticos de validación, el documento se marca como `valid` y sus datos pasan al resultado final (ej: Excel Master).
    - **Requiere Revisión:** Si la confianza general es **baja** o si se detecta algún **error crítico** en la validación, el documento se marca como `needs_review` y se envía a la cola de revisión para una supervisión humana.

---

## 3. Ventajas del Nuevo Sistema

- **Máxima Precisión:** Al analizar campo por campo y usar prompts especializados, se reduce drásticamente el riesgo de errores, especialmente en casillas de verificación.
- **Eficiencia Inteligente:** Se reserva el uso de los modelos de IA más potentes (y costosos) solo para los casos donde un método más simple no es suficiente, optimizando costes y tiempo.
- **Robustez ante la Realidad:** El sistema de recalibración (Capa 2) lo hace resistente a la variabilidad de los escaneos del mundo real (documentos torcidos, márgenes distintos, etc.).
- **Automatización y Escalabilidad:** El flujo "Zero-Touch" permite procesar grandes lotes de documentos de forma asíncrona con una mínima intervención humana, centrando la atención del operario solo en los casos que la IA no ha podido resolver con certeza.
