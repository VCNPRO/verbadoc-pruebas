# VerbadocPro - Guia Completa de Usuario

**VideoConversion Digital Lab SL** | Documentacion Confidencial | Febrero 2026 | v3.0

**Tecnologia de Orquestacion Documental Propietaria**

---

## Indice

1. Introduccion a VerbadocPro
2. Acceso y Configuracion Inicial
3. Panel Principal: Extraccion de Datos
4. Procesamiento por Lotes
5. Revision y Validacion de Documentos
6. Biblioteca Inteligente (Consulta por Lenguaje Natural)
7. Consulta Inteligente: Panel de Configuracion Avanzada
8. Master Excel: Exportacion Consolidada
9. Mapeo de Columnas Personalizado
10. Documentos No Procesables
11. Administracion de Usuarios y Roles
12. Modulos y Funcionalidades Disponibles
13. Entrada y Salida de Voz
14. Asistente Virtual Laia
15. Internacionalizacion (9 idiomas)
16. Seguridad, Privacidad y Cumplimiento Normativo
17. Resolucion de Incidencias Comunes
18. Glosario de Terminos
19. Soporte y Contacto

---

## 1. Introduccion a VerbadocPro

VerbadocPro es una plataforma de orquestacion documental con inteligencia artificial que transforma cualquier tipo de documento (impreso, manuscrito, escaneado, fotografico o de audio) en datos estructurados y consultables.

### Que puede hacer VerbadocPro

- **Extraer datos** de cualquier documento: PDFs, imagenes, fotografias antiguas, documentos manuscritos, grabaciones de audio
- **Procesar miles de documentos** en lotes automatizados
- **Consultar su fondo documental** como si hablara con un experto que ha leido todos sus archivos
- **Validar automaticamente** los datos extraidos contra reglas de negocio y datos de referencia
- **Exportar resultados** en multiples formatos (Excel, CSV, PDF, JSON)
- **Organizar documentos** en carpetas tematicas con indexacion semantica
- **Reconocer texto** en manuscritos, fotografias antiguas con marcos, planos y documentos historicos
- **Transcribir audio** automaticamente con identificacion de interlocutores

### Para quien es VerbadocPro

- Administraciones publicas con grandes fondos documentales
- Empresas de formacion bonificada (FUNDAE)
- Archivos historicos y bibliotecas
- Departamentos de RRHH, contabilidad y administracion
- Despachos profesionales (abogados, gestores, consultores)
- Empresas de logistica y almacen
- Centros sanitarios y farmaceuticos

---

## 2. Acceso y Configuracion Inicial

### 2.1 Registro e inicio de sesion

1. Acceda a **verbadocpro.eu** desde cualquier navegador moderno
2. Si tiene cuenta, introduzca su email y contrasena
3. Si es nuevo, pulse "Registrarse" y complete:
   - Nombre completo
   - Email corporativo
   - Contrasena (minimo 8 caracteres)
   - Empresa (opcional)

### 2.2 Seleccion de idioma

Desde el selector de idioma en la barra superior, elija entre:

| Idioma | Codigo |
|--------|--------|
| Espanol | ES |
| Catala | CA |
| Galego | GL |
| Euskara | EU |
| Portugues | PT |
| Francais | FR |
| English | EN |
| Italiano | IT |
| Deutsch | DE |

La interfaz completa, las respuestas de la IA y el asistente Laia se adaptaran al idioma seleccionado.

### 2.3 Modo claro / oscuro

VerbadocPro incluye modo oscuro para reducir la fatiga visual. Active o desactive desde el icono de configuracion.

---

## 3. Panel Principal: Extraccion de Datos

El panel principal se divide en dos columnas:
- **Izquierda**: Area de carga y vista previa del documento
- **Derecha**: Datos extraidos y editor de campos

### 3.1 Subir un documento

**Metodos de carga:**
- Arrastre y suelte el archivo sobre el area de carga
- Pulse "Seleccionar archivo" para navegar en su equipo

**Formatos soportados:**

| Tipo | Formatos |
|------|----------|
| Documentos | PDF (digital, escaneado o hibrido) |
| Imagenes | JPG, PNG, TIFF, WebP, GIF, BMP |
| Audio | MP3, WAV, OGG, WebM, M4A, FLAC, AAC |
| Texto | TXT, documentos de texto plano |

**Tamano maximo**: 25 MB por archivo

### 3.2 Proceso de extraccion

Una vez subido el documento:

1. **Analisis automatico**: El sistema detecta el tipo de documento (digital, escaneado, manuscrito, imagen, audio)
2. **Extraccion inteligente**: La IA identifica y extrae todos los campos relevantes
3. **Validacion inmediata**: Se aplican reglas de validacion automaticas
4. **Presentacion de resultados**: Los datos aparecen en el editor de la columna derecha

**Tiempo medio de procesamiento**: 2-10 segundos por documento, dependiendo de la complejidad.

### 3.3 Edicion de campos extraidos

Cada campo extraido puede:
- **Editarse directamente** haciendo clic sobre el valor
- **Marcarse como correcto** para confirmacion
- **Anotarse** con observaciones adicionales

### 3.4 Plantillas de extraccion

VerbadocPro permite crear plantillas personalizadas que definen que campos extraer de cada tipo de documento. Para crear una plantilla:

1. Pulse "Plantillas" en el menu lateral
2. Pulse "Nueva plantilla"
3. Defina los campos: nombre, tipo de dato, si es obligatorio
4. Guarde y seleccione la plantilla antes de procesar documentos

**Tipos de campo disponibles**: texto, numero, fecha, CIF/NIF, email, telefono, lista de opciones, booleano.

---

## 4. Procesamiento por Lotes

Para procesar grandes volumenes de documentos de forma automatizada.

### 4.1 Crear un lote

1. Acceda a **"Procesamiento por lotes"**
2. Asigne un nombre al lote (ej: "Facturas Q1 2025")
3. Arrastre hasta **500 archivos** simultaneamente
4. Pulse **"Iniciar procesamiento"**

### 4.2 Seguimiento en tiempo real

Durante el procesamiento vera:
- **Barra de progreso**: Porcentaje completado
- **Documentos procesados**: X de Y
- **Tiempo estimado restante**: Calculado automaticamente
- **Estado individual**: Cada documento muestra su estado (pendiente, procesando, completado, error)

### 4.3 Reintentos automaticos

Si un documento falla, el sistema reintenta automaticamente hasta 3 veces antes de marcarlo como fallido. Los documentos fallidos pueden reprocessarse manualmente.

### 4.4 Resultados del lote

Al completarse:
- Descargue el **Excel consolidado** con todos los datos
- Revise documentos individuales que necesiten atencion
- Consulte estadisticas del lote (tasa de exito, tiempo total, errores)

---

## 5. Revision y Validacion de Documentos

### 5.1 Panel de revision

Acceda desde **"Revision"** en el menu. Vera una lista de todos los documentos con:
- **Estado**: Pendiente, Necesita revision, Valido, Rechazado
- **Filtros**: Por estado, fecha, nombre de archivo
- **Busqueda**: Por nombre de documento

### 5.2 Revisar un documento

Al abrir un documento en revision:
- **Lado izquierdo**: Visor del documento original (PDF/imagen)
- **Lado derecho**: Errores de validacion detectados

Para cada error puede:
- **Corregir**: Introduzca el valor correcto y, opcionalmente, una nota explicativa
- **Ignorar**: Si el error no es relevante para su caso
- **Editar inline**: Modifique el campo directamente

### 5.3 Tipos de validacion automatica

| Validacion | Que comprueba |
|-----------|---------------|
| Formato CIF/NIF/NIE | Estructura correcta del identificador fiscal |
| Coherencia de fechas | Fecha inicio anterior a fecha fin |
| Campos obligatorios | Que no falten datos criticos |
| Rangos numericos | Valores dentro de limites logicos |
| Email y telefono | Formato correcto |
| Codigo postal | 5 digitos validos para Espana |
| Edad | Rango razonable segun contexto |

### 5.4 Validacion cruzada

Si dispone de un Excel de referencia, VerbadocPro compara automaticamente los datos extraidos contra esos datos de referencia:

- **Campos criticos**: Numero de expediente, CIF, importe total
- **Tolerancia numerica**: 1% para importes
- **Normalizacion de fechas**: Diferentes formatos se comparan correctamente
- **Resultado**: Porcentaje de coincidencia y lista de discrepancias

### 5.5 Estados del documento

```
Pendiente → En proceso → Valido / Necesita revision → Aprobado / Rechazado
```

---

## 6. Biblioteca Inteligente (Consulta por Lenguaje Natural)

La Biblioteca Inteligente es la funcion mas avanzada de VerbadocPro. Permite interrogar a todo su fondo documental como si hablara con un experto que ha leido cada pagina.

### 6.1 Como funciona

1. **Usted sube documentos** a la Biblioteca (PDFs, imagenes, audios)
2. **El sistema indexa** todo el contenido automaticamente, incluyendo:
   - Texto de documentos
   - Texto visible en fotografias (nombres, fechas, sellos, dedicatorias)
   - Transcripciones de audio
3. **Usted pregunta** en lenguaje natural
4. **El sistema responde** con una respuesta redactada y las fuentes numeradas

### 6.2 Subir documentos a la Biblioteca

1. Vaya a **"Biblioteca"** en el menu
2. Cree carpetas para organizar tematicamente (ej: "Expedientes 2024", "Contratos", "Fotografias historicas")
3. Pulse **"Subir documento"**
4. Seleccione archivos: PDF, imagenes o audio
5. El sistema procesara e indexara cada documento automaticamente

**Para imagenes y fotografias**: El sistema extrae todo el texto visible (carteles, inscripciones, fechas en marcos, sellos, etiquetas, firmas) ademas de describir el contenido visual. Esto es especialmente util para fotografias antiguas con marcos blancos que contienen dedicatorias, fechas o nombres.

**Para audio**: Se transcribe automaticamente todo el contenido hablado, identificando interlocutores.

### 6.3 Organizacion en carpetas

- Cree carpetas por tema, departamento, periodo o proyecto
- Puede filtrar las consultas por carpeta para buscar solo en documentos especificos
- Un documento puede pertenecer a una carpeta

### 6.4 Hacer una consulta

Escriba su pregunta en el cuadro de busqueda como si hablara con un colega experto:

**Ejemplos de consultas eficaces:**

| Tipo de consulta | Ejemplo |
|-----------------|---------|
| Dato concreto | "Cual es el NIF de la empresa que firmo el contrato de 2019?" |
| Comparativa | "Compara los presupuestos de 2023 y 2024" |
| Resumen | "Resume las conclusiones del informe tecnico del edificio municipal" |
| Busqueda temporal | "Que expedientes de obras se tramitaron entre 2015 y 2020?" |
| Fotografia | "En que fotos aparece texto con la fecha 1952?" |
| Legal | "Que clausulas de renovacion automatica tienen los contratos vigentes?" |
| Audio | "Que se dijo en la reunion del 15 de enero sobre el presupuesto?" |

### 6.5 Interpretar los resultados

Cada respuesta incluye:
- **Respuesta redactada**: Texto coherente que responde a su pregunta
- **Fuentes numeradas**: Fuente 1, Fuente 2, etc., con el nombre del documento y la pagina
- **Porcentaje de relevancia**: Indica la confianza del sistema en cada fuente
- **Boton "Ver"**: Para abrir el documento original y verificar la informacion

### 6.6 Conversacion continua

El sistema mantiene el contexto de la conversacion. Puede refinar sus preguntas:
1. "Que contratos vencen en 2025?"
2. "De esos, cuales tienen clausula de renovacion automatica?"
3. "Resumeme las condiciones de renovacion del primero"

---

## 7. Consulta Inteligente: Panel de Configuracion Avanzada

Para obtener resultados optimos segun el tipo de consulta, el sistema permite ajustar cuatro parametros.

### 7.1 Motor de Inferencia (Nivel de Procesamiento)

| Motor | Descripcion | Uso recomendado |
|-------|-------------|----------------|
| **Motor Estandar** (Agilidad) | Respuestas casi instantaneas (1-2 seg). Procesamiento rapido y directo. | Consultas rapidas, datos concretos, uso diario |
| **Motor Avanzado** (Equilibrado) | Mayor capacidad de sintesis y razonamiento contextual. | Comparativas entre documentos, resumenes de carpetas |
| **Motor de Alta Densidad** (Precision) | Maxima capacidad analitica para casos complejos. | Analisis legal, datos tecnicos, manuscritos, fotografia |

### 7.2 Profundidad de Contexto

Define cuantos fragmentos del fondo documental analiza la IA antes de generar la respuesta.

- **Valor bajo (1-3)**: Respuesta rapida y directa. Ideal para buscar un dato unico (NIF, fecha, firma).
- **Valor medio (4-6)**: Equilibrio entre rapidez y amplitud. Recomendado para uso general.
- **Valor alto (7-10)**: La IA lee mas fragmentos antes de contestar. Ideal para resumenes o informacion dispersa en varios documentos.

### 7.3 Rigurosidad de Hallazgo (Filtro de Precision)

Ajusta que tan parecido debe ser el contenido encontrado a su pregunta.

- **Modo Flexible (0-30%)**: Amplia la busqueda a terminos relacionados semanticamente. Util cuando no esta seguro del termino exacto.
- **Modo Equilibrado (30-60%)**: Recomendado para uso general.
- **Modo Estricto (60-100%)**: Solo informacion con alta coincidencia tecnica. Recomendado cuando conoce los terminos exactos.

### 7.4 Indice de Creatividad (Estilo de Redaccion)

Controla la libertad de redaccion de la IA al componer la respuesta.

- **Modo Tecnico (0.0-0.3)**: Respuestas literales y deterministas. Para datos numericos, legales y de auditoria.
- **Modo Equilibrado (0.3-0.6)**: Recomendado para uso general.
- **Modo Narrativo (0.6-1.0)**: Redaccion mas fluida y explicativa. Para conclusiones, borradores y sintesis.

### 7.5 Guia rapida de configuracion

| Si quiere... | Configuracion sugerida |
|-------------|----------------------|
| Un dato concreto rapido | Motor Estandar + Profundidad Baja + Rigurosidad Media |
| Un analisis legal preciso | Motor Alta Densidad + Profundidad Media + Creatividad Tecnica |
| Resumir varios archivos | Motor Avanzado + Profundidad Alta + Creatividad Narrativa |
| Extraer datos de manuscritos | Motor Alta Densidad + Profundidad Alta + Creatividad Tecnica |
| Analizar planos o fotografias | Motor Avanzado + Profundidad Media + Creatividad Narrativa |
| Busqueda general exploratoria | Motor Avanzado + Profundidad Media + Rigurosidad Flexible |

---

## 8. Master Excel: Exportacion Consolidada

### 8.1 Vista consolidada

Acceda a **"Master Excel"** para ver una tabla con todas sus extracciones:
- ID de extraccion
- Nombre del archivo
- Estado de validacion
- Resultado de validacion cruzada
- Numero de discrepancias
- Fecha de procesamiento

### 8.2 Busqueda y ordenamiento

- **Buscar**: Filtre por nombre de archivo
- **Ordenar**: Por nombre o fecha (ascendente/descendente)
- **Filtrar**: Por estado de validacion

### 8.3 Exportacion

Pulse **"Descargar Excel Master"** para obtener un archivo .xlsx con:
- **Hoja "Extracciones"**: Todos los datos extraidos
- **Hoja "Errores de Validacion"**: Detalle de cada error encontrado
- **Hoja "Validacion Cruzada"**: Comparativa con datos de referencia

---

## 9. Mapeo de Columnas Personalizado

Para adaptar la exportacion a su formato Excel de destino:

1. Acceda a **"Configuracion" > "Mapeo de columnas"**
2. Para cada campo de VerbadocPro, asigne la columna de destino en su Excel
3. Aplique transformaciones si es necesario:
   - **Mayusculas**: Convierte el texto a MAYUSCULAS
   - **Minusculas**: Convierte a minusculas
   - **Formato de fecha**: Normaliza fechas al formato deseado
   - **Expansion de codigos**: Convierte codigos de ciudad a nombres completos
4. Guarde la configuracion (se mantiene entre sesiones)

---

## 10. Documentos No Procesables

Algunos documentos pueden no procesarse correctamente. VerbadocPro los clasifica automaticamente:

| Categoria | Descripcion |
|----------|-------------|
| Sin referencia | No se encuentra en los datos de referencia |
| Campos faltantes | Faltan datos criticos obligatorios |
| Formulario incompleto | El documento esta parcialmente cumplimentado |
| Ilegible | Calidad insuficiente para extraccion |
| Incompleto | Faltan paginas o secciones |
| Duplicado | Ya existe una version procesada |
| Error critico | Error irrecuperable en el procesamiento |
| Formato invalido | Formato de archivo no soportado |

Para cada documento no procesable puede:
- **Ver el original** para diagnosticar el problema
- **Reintentar el procesamiento** tras corregir el problema
- **Reclasificar** manualmente si la categoria es incorrecta

---

## 11. Administracion de Usuarios y Roles

*(Solo disponible para administradores)*

### 11.1 Roles disponibles

| Rol | Permisos |
|-----|---------|
| **Usuario** | Extraer documentos, ver sus propios resultados, usar Biblioteca |
| **Revisor** | Todo lo de Usuario + revisar/aprobar/rechazar documentos, ingestar en Biblioteca |
| **Administrador** | Todo + gestionar usuarios, ver estadisticas globales, configurar modulos |

### 11.2 Gestionar usuarios

1. Acceda a **"Administracion"** en el menu
2. Vera la lista de todos los usuarios registrados
3. Para cambiar el rol de un usuario, pulse **"Hacer Admin"** o **"Cambiar rol"**

---

## 12. Modulos y Funcionalidades Disponibles

VerbadocPro es modular. Los modulos disponibles incluyen:

- **Extraccion de datos**: Modulo base de procesamiento documental
- **Procesamiento por lotes**: Procesamiento automatizado de grandes volumenes
- **Biblioteca Inteligente**: Consulta por lenguaje natural al fondo documental
- **Validacion avanzada**: Reglas de validacion y validacion cruzada con datos de referencia
- **Exportacion avanzada**: Formatos multiples y mapeo de columnas
- **Reconocimiento de manuscritos**: HTR (Handwritten Text Recognition)
- **Transcripcion de audio**: Conversion de audio a texto con identificacion de hablantes
- **Deteccion de codigos**: Lectura de QR y codigos de barras con validacion cruzada

---

## 13. Entrada y Salida de Voz

### 13.1 Consulta por voz (Speech-to-Text)

Pulse el icono de microfono para dictar su consulta en lugar de escribirla. Compatible con los 9 idiomas soportados.

**Consejos para dictado por voz:**
- Hable con claridad y a ritmo normal
- Funciona mejor en entornos sin ruido de fondo
- El sistema muestra el texto en tiempo real mientras habla
- Compatible con Chrome, Edge y Safari

### 13.2 Lectura de respuestas (Text-to-Speech)

El sistema puede leer en voz alta las respuestas. Configure:
- **Velocidad de lectura**: De lenta a rapida
- **Tono de voz**: Ajustable
- **Voz**: Seleccione entre las voces disponibles en su idioma

---

## 14. Asistente Virtual Laia

Laia es la asistente de IA integrada en VerbadocPro. Acceda pulsando el boton de chat en la esquina inferior.

**Laia puede ayudarle con:**
- Dudas sobre como usar cualquier funcion de la plataforma
- Consejos para mejorar la calidad de sus consultas
- Informacion sobre tipos de documentos soportados
- Explicaciones sobre los ajustes de configuracion
- Guia paso a paso para tareas especificas
- Informacion sobre seguridad y cumplimiento normativo
- Resolución de problemas comunes

**Laia responde en el idioma que tenga seleccionado.**

---

## 15. Internacionalizacion

VerbadocPro esta completamente traducido a 9 idiomas europeos. La internacionalizacion abarca:

- **Interfaz de usuario**: Todos los menus, botones y mensajes
- **Respuestas de la IA**: Las consultas a la Biblioteca se responden en su idioma
- **Asistente Laia**: Responde en su idioma
- **Reconocimiento de voz**: Entiende su idioma hablado
- **Sintesis de voz**: Lee las respuestas en su idioma
- **Documentos fuente**: La IA puede analizar documentos en cualquier idioma

---

## 16. Seguridad, Privacidad y Cumplimiento Normativo

### 16.1 Infraestructura

- **100% Europea**: Todos los datos se procesan y almacenan en la Union Europea
- **Cifrado en transito**: Todas las comunicaciones viajan cifradas (TLS/HTTPS)
- **Backups automaticos**: Copias de seguridad diarias cifradas

### 16.2 Cumplimiento normativo

- **RGPD** (Reglamento General de Proteccion de Datos): Cumplimiento total
  - Derecho al olvido: Eliminacion completa de datos bajo solicitud
  - Auditoria de acceso: Registro de todas las acciones
  - Aislamiento por usuario: Cada usuario solo ve sus propios datos
- **ENS** (Esquema Nacional de Seguridad): Cumplimiento de medidas aplicables
  - Autenticacion segura
  - Control de acceso basado en roles
  - Trazabilidad completa de operaciones

### 16.3 Privacidad

- Sus documentos son **privados**: solo usted (y los administradores autorizados) pueden acceder a ellos
- Las consultas a la Biblioteca son **individuales**: otros usuarios no ven sus preguntas ni respuestas
- Los datos de auditoria se conservan segun los periodos legales establecidos

---

## 17. Resolucion de Incidencias Comunes

| Problema | Solucion |
|----------|----------|
| La respuesta es muy generica o vaga | Aumente la Profundidad de Contexto y use el Motor de Alta Densidad. Reformule con mas detalle. |
| El sistema tarda demasiado | Cambie al Motor Estandar y reduzca la Profundidad de Contexto. |
| No encuentra el dato que busco | Reduzca la Rigurosidad al Modo Flexible. Pruebe con sinonimos. |
| Mezcla informacion de documentos no relacionados | Aumente la Rigurosidad al Modo Estricto y reduzca la Profundidad. |
| Necesito mas detalle en la respuesta | Suba el Indice de Creatividad al Modo Narrativo y aumente la Profundidad. |
| El documento no se procesa | Verifique que el formato es soportado y que el tamano no excede 25 MB. |
| Texto manuscrito no se reconoce bien | Use el Motor de Alta Densidad. Asegurese de que el escaneo tiene buena resolucion. |
| El audio no se transcribe | Verifique que el formato es soportado (MP3, WAV, OGG, M4A, FLAC, AAC). |
| No puedo acceder a la Biblioteca | Verifique que su usuario tiene el modulo de Biblioteca activado. Contacte con su administrador. |

---

## 18. Glosario de Terminos

| Termino | Definicion |
|---------|-----------|
| **Biblioteca Inteligente** | Sistema de consulta por lenguaje natural al fondo documental |
| **Consulta Inteligente** | Funcion de pregunta-respuesta sobre documentos indexados |
| **Motor de Inferencia** | Nivel de potencia de analisis de la IA |
| **Profundidad de Contexto** | Cantidad de fragmentos documentales analizados por consulta |
| **Rigurosidad de Hallazgo** | Filtro de precision en la busqueda semantica |
| **Indice de Creatividad** | Estilo de redaccion de la respuesta (tecnico a narrativo) |
| **Validacion cruzada** | Comparacion automatica de datos extraidos contra datos de referencia |
| **Procesamiento por lotes** | Procesamiento automatizado de multiples documentos |
| **Fuente** | Documento original del que se extrae la informacion de una respuesta |
| **Indexacion semantica** | Proceso de analisis y catalogacion del contenido documental |
| **HTR** | Reconocimiento de texto manuscrito (Handwritten Text Recognition) |

---

## 19. Soporte y Contacto

- **Asistente Laia**: Disponible 24/7 en la plataforma
- **Soporte tecnico**: Respuesta maxima en 24h laborables
- **Infraestructura**: 100% Europea
- **Cumplimiento**: RGPD y ENS
- **Web**: verbadocpro.eu

---

*VideoConversion Digital Lab SL | Tecnologia de Orquestacion Documental Propietaria*
*Documentacion Confidencial | Febrero 2026*
