# Guia de Usuario: "Preguntale al Documento" - Ajustes Avanzados

**VerbadocPro** | Febrero 2026
**Para: Usuarios finales y administradores**

---

## Que es "Preguntale al Documento"?

Es la funcion de **inteligencia artificial** de VerbadocPro que te permite hacer preguntas en lenguaje natural sobre tus documentos. En lugar de buscar manualmente en cada archivo, simplemente escribe tu pregunta y el sistema encuentra la respuesta automaticamente.

**Ejemplo**: Tienes 50 contratos subidos. Escribes *"Cual es el importe del contrato con Iberdrola?"* y el sistema te responde con la cifra exacta y te indica en que documento la encontro.

---

## Panel de Ajustes Avanzados

Al hacer clic en el boton **"Ajustes avanzados"** (icono de engranaje) debajo del selector de carpeta, se despliega un panel con cuatro controles que permiten personalizar como responde la IA.

> **Nota**: Los valores por defecto funcionan bien para la mayoria de consultas. Solo ajusta estos controles si necesitas un comportamiento especifico.

---

## 1. Motor de Inferencia

Permite elegir que motor de inteligencia artificial procesa tu pregunta.

| Motor | Descripcion | Cuando usarlo |
|-------|-------------|---------------|
| **Motor Estandar** (Agilidad) | Respuestas en 1-2 segundos. Buena calidad. | **Recomendado para uso diario**. Consultas rapidas, verificaciones, busquedas simples. |
| **Motor Avanzado** (Equilibrado) | Respuestas en 2-4 segundos. Mayor capacidad de razonamiento. | Cuando necesitas respuestas mas elaboradas o la pregunta es compleja. |
| **Motor de Alta Densidad** (Precision) | Respuestas en 3-6 segundos. Maxima precision. | Para analisis detallados, documentos legales complejos, o cuando necesitas la mayor fiabilidad posible. |

### Ejemplos practicos por motor

**Ejemplo 1 - Consulta simple (usar Motor Estandar)**:
> "Cual es la fecha del contrato?"
> Respuesta rapida y directa. No necesita un motor mas potente.

**Ejemplo 2 - Consulta compleja (usar Motor Avanzado o Alta Densidad)**:
> "Compara las condiciones de pago del contrato A con el contrato B y dime cual es mas favorable"
> Requiere razonamiento comparativo. Un motor mas potente dara mejor resultado.

**Ejemplo 3 - Documento legal (usar Motor de Alta Densidad)**:
> "Que implicaciones legales tiene la clausula 7.3 sobre penalizaciones?"
> Analisis juridico que se beneficia de la maxima precision del motor.

---

## 2. Indice de Creatividad

El control deslizante de **Indice de Creatividad** ajusta lo "creativa" o "estricta" que es la respuesta.

```
Tecnico ◄──────────────────────────► Narrativo
  0.0                                  1.0
```

| Rango | Que hace | Ejemplo |
|-------|----------|---------|
| **0.0 - 0.2** (Tecnico) | Respuestas casi identicas cada vez. Se cine estrictamente al texto del documento. | *"Cual es el NIF del proveedor?"* -> Siempre devuelve el mismo NIF exacto |
| **0.3** (Por defecto) | Equilibrio entre precision y naturalidad. | Funciona bien para la mayoria de preguntas |
| **0.4 - 0.6** (Balanceado) | Respuestas con algo mas de elaboracion y variacion. | *"Resumeme el documento"* -> Resumenes ligeramente diferentes cada vez |
| **0.7 - 1.0** (Narrativo) | Respuestas mas variadas y elaboradas. | *"Que opinas sobre el enfoque de este informe?"* -> Respuestas mas interpretativas |

### Cuando ajustar el Indice de Creatividad

| Tarea | Valor recomendado |
|-------|-------------------|
| Extraer datos concretos (NIF, fechas, importes) | **0.0 - 0.1** |
| Consultas generales sobre documentos | **0.3** (default) |
| Resumenes y explicaciones | **0.4 - 0.5** |
| Analisis y opiniones sobre contenido | **0.6 - 0.8** |

---

## 3. Profundidad de Contexto

Controla **cuantos fragmentos de tus documentos** analiza la IA como referencia para responder.

```
Menos profundidad ◄────────────────────► Mas profundidad
       1                                       10
```

| Valor | Que hace | Cuando usarlo |
|-------|----------|---------------|
| **1 - 2** | Analiza solo los 1-2 fragmentos mas relevantes | Preguntas muy especificas sobre un dato concreto |
| **3 - 5** (default) | Equilibrio entre cobertura y velocidad | **Uso general**. Funciona bien para la mayoria de preguntas |
| **6 - 8** | Mas contexto, analiza mas partes del documento | Preguntas que abarcan varias secciones del documento |
| **9 - 10** | Maximo contexto disponible | Documentos muy largos donde la informacion esta dispersa |

### Ejemplos practicos

**Ejemplo con Profundidad 2**:
> Pregunta: "Cual es el telefono de contacto?"
> El sistema analiza solo los 2 fragmentos mas relevantes. Rapido y preciso para datos puntuales.

**Ejemplo con Profundidad 5** (default):
> Pregunta: "Que servicios se incluyen en el contrato?"
> El sistema revisa 5 fragmentos. Puede encontrar servicios mencionados en diferentes clausulas.

**Ejemplo con Profundidad 10**:
> Pregunta: "Hazme un resumen completo del documento"
> El sistema lee 10 fragmentos para tener la vision mas amplia posible del documento.

---

## 4. Rigurosidad de Hallazgo

Establece un **filtro de calidad** sobre los resultados. Solo se usan fragmentos cuya relevancia supere el nivel de rigurosidad.

```
Modo Flexible ◄────────────────────────► Modo Estricto
    0.00                                      1.00
```

| Valor | Que hace | Cuando usarlo |
|-------|----------|---------------|
| **0.00** (default) | Modo Flexible. Siempre devuelve el numero de fuentes configurado | **Uso general**. Funciona bien casi siempre |
| **0.10 - 0.30** | Filtro suave. Elimina resultados muy poco relevantes | Cuando tienes muchos documentos de temas variados |
| **0.40 - 0.60** | Filtro moderado. Solo resultados razonablemente relacionados | Busquedas precisas en colecciones grandes |
| **0.70 - 0.90** | Modo Estricto. Solo resultados muy relevantes | Documentos legales, compliance, cuando la precision es critica |

### Ejemplo practico

Tienes una carpeta con 100 documentos (contratos, facturas, manuales). Preguntas:
> "Cual es la penalizacion por retraso en la entrega?"

- **Rigurosidad 0.00 (Flexible)**: Devuelve 5 fragmentos, algunos quiza poco relevantes (ej: una factura que menciona "entrega")
- **Rigurosidad 0.50 (Moderado)**: Devuelve solo los fragmentos que realmente hablan de penalizaciones
- **Rigurosidad 0.80 (Estricto)**: Devuelve solo los fragmentos que hablan especificamente de penalizaciones por retraso

> **Atencion**: Si la rigurosidad es muy alta, es posible que no se encuentren resultados y la IA responda "No tengo informacion sobre esto en los documentos". En ese caso, baja la rigurosidad.

---

## 5. Memoria de Conversacion

VerbadocPro **recuerda las ultimas 5 preguntas y respuestas** de tu sesion. Esto permite hacer preguntas de seguimiento de forma natural, como en una conversacion.

### Como funciona

La IA toma tu pregunta de seguimiento y la combina con el contexto previo para entender que necesitas.

### Ejemplo de conversacion

| Turno | Tu pregunta | Lo que la IA entiende |
|-------|-------------|----------------------|
| 1 | "Quien es el proveedor del contrato?" | (pregunta directa, busca tal cual) |
| 2 | "Y cual es su NIF?" | "Cual es el NIF de [proveedor del turno 1]?" |
| 3 | "Cuando se firmo?" | "Cuando se firmo el contrato con [proveedor]?" |
| 4 | "Hay clausula de penalizacion?" | "Hay clausula de penalizacion en el contrato con [proveedor]?" |
| 5 | "Cuanto es la penalizacion?" | "Cual es el importe de la penalizacion en el contrato con [proveedor]?" |

### Boton "Limpiar conversacion"

Cuando hay historial de conversacion, aparece un boton con el texto **"Limpiar conversacion (N)"** donde N es el numero de turnos. Al pulsarlo:
- Se borra el historial de la sesion
- La siguiente pregunta se trata como una consulta nueva e independiente
- Se limpia tambien la respuesta actual y el campo de texto

**Cuando limpiar**: Si cambias de tema (por ejemplo, pasas de preguntar sobre un contrato a preguntar sobre una factura), es recomendable limpiar la conversacion para evitar confusion.

---

## 6. Escenarios de Uso Recomendados

### Escenario A: Busqueda rapida de datos

> **Objetivo**: Encontrar un dato concreto (NIF, fecha, importe)

| Ajuste | Valor |
|--------|-------|
| Motor de Inferencia | Motor Estandar (Agilidad) |
| Indice de Creatividad | 0.0 - 0.1 |
| Profundidad de Contexto | 2 - 3 |
| Rigurosidad de Hallazgo | 0.00 (Flexible) |

**Ejemplo**: *"Cual es el CIF de la empresa contratante?"*

---

### Escenario B: Resumen de documento

> **Objetivo**: Obtener una vision general del contenido

| Ajuste | Valor |
|--------|-------|
| Motor de Inferencia | Motor Estandar o Motor Avanzado |
| Indice de Creatividad | 0.4 - 0.5 |
| Profundidad de Contexto | 7 - 10 |
| Rigurosidad de Hallazgo | 0.00 (Flexible) |

**Ejemplo**: *"Hazme un resumen de los puntos principales del contrato"*

---

### Escenario C: Analisis legal o compliance

> **Objetivo**: Encontrar clausulas especificas con maxima precision

| Ajuste | Valor |
|--------|-------|
| Motor de Inferencia | Motor de Alta Densidad (Precision) |
| Indice de Creatividad | 0.1 |
| Profundidad de Contexto | 5 - 8 |
| Rigurosidad de Hallazgo | 0.50 - 0.70 |

**Ejemplo**: *"Que dice la clausula de proteccion de datos sobre transferencias internacionales?"*

---

### Escenario D: Comparacion entre documentos

> **Objetivo**: Comparar informacion de diferentes documentos en la misma carpeta

| Ajuste | Valor |
|--------|-------|
| Motor de Inferencia | Motor Avanzado o Alta Densidad |
| Indice de Creatividad | 0.3 |
| Profundidad de Contexto | 8 - 10 |
| Rigurosidad de Hallazgo | 0.00 (Flexible) |

**Ejemplo**: *"Compara las condiciones de pago del contrato de 2024 con el de 2025"*

---

### Escenario E: Sesion de preguntas encadenadas

> **Objetivo**: Explorar un documento con preguntas de seguimiento

| Ajuste | Valor |
|--------|-------|
| Motor de Inferencia | Motor Estandar (Agilidad) |
| Indice de Creatividad | 0.3 |
| Profundidad de Contexto | 5 |
| Rigurosidad de Hallazgo | 0.00 (Flexible) |

**Ejemplo de conversacion**:
1. *"De que trata este documento?"*
2. *"Quienes son las partes involucradas?"*
3. *"Cuanto dura el acuerdo?"*
4. *"Hay clausula de rescision anticipada?"*
5. *"Que penalizacion tiene?"*

> Recuerda pulsar **"Limpiar conversacion"** cuando cambies de tema.

---

### Escenario F: Busqueda en coleccion grande con filtro

> **Objetivo**: Buscar informacion especifica en una carpeta con muchos documentos

| Ajuste | Valor |
|--------|-------|
| Motor de Inferencia | Motor Estandar (Agilidad) |
| Indice de Creatividad | 0.2 |
| Profundidad de Contexto | 5 |
| Rigurosidad de Hallazgo | 0.40 - 0.60 |

**Ejemplo**: Carpeta "Facturas 2025" con 200 facturas.
*"Cual es el total de la factura de Telefonica de marzo?"*
La rigurosidad filtra las facturas no relacionadas con Telefonica ni con marzo.

---

## 7. Preguntas Frecuentes

### "La IA dice que no tiene informacion, pero yo se que esta en el documento"

- **Baja la Rigurosidad de Hallazgo** a 0.00 (Modo Flexible)
- **Sube la Profundidad de Contexto** a 8-10 para que analice mas fragmentos
- Reformula la pregunta con terminos que aparezcan en el documento
- Verifica que el documento esta en la carpeta seleccionada

### "La respuesta es demasiado generica"

- **Sube la Profundidad de Contexto** para dar mas informacion a la IA
- Usa un **motor mas potente** (Avanzado o Alta Densidad)
- Se mas especifico en tu pregunta

### "La respuesta tarda mucho"

- Usa el **Motor Estandar** (el mas rapido)
- **Baja la Profundidad de Contexto** a 2-3
- La primera consulta de la sesion puede tardar algo mas mientras el sistema se prepara

### "Las preguntas de seguimiento no funcionan bien"

- Asegurate de que aparece el boton "Limpiar conversacion" (indica que hay historial activo)
- Si cambiaste de tema, **limpia la conversacion** primero
- Las preguntas de seguimiento funcionan mejor cuando son claras: "Y su NIF?" es mejor que "NIF?"

### "Quiero la respuesta en otro idioma"

- El idioma de respuesta se ajusta automaticamente segun el idioma de la interfaz (selector de idioma de VerbadocPro)
- Idiomas soportados: Espanol, Catalan, Gallego, Euskera, Portugues, Frances, Ingles, Italiano, Aleman

---

## 8. Tabla Rapida de Referencia

| Quiero... | Motor | Creatividad | Profundidad | Rigurosidad |
|-----------|-------|-------------|-------------|-------------|
| Dato concreto rapido | Estandar | 0.0 | 2 | 0.00 |
| Consulta general | Estandar | 0.3 | 5 | 0.00 |
| Resumen completo | Estandar / Avanzado | 0.4 | 8-10 | 0.00 |
| Analisis legal preciso | Alta Densidad | 0.1 | 5-8 | 0.50 |
| Comparar documentos | Avanzado / Alta Densidad | 0.3 | 10 | 0.00 |
| Buscar en coleccion grande | Estandar | 0.2 | 5 | 0.40 |
| Explorar con preguntas seguidas | Estandar | 0.3 | 5 | 0.00 |

---

*Documento generado para VerbadocPro v2.0 - Febrero 2026*
*VideoConversion Digital Lab SL | verbadocpro.eu*
