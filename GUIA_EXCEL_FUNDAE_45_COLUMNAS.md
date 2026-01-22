# Guía del Excel FUNDAE - 45 Columnas Oficiales

## Introducción

El sistema VerbadocPro genera archivos Excel que cumplen **exactamente** con el formato oficial FUNDAE para el "Cuestionario para la Evaluación de la Calidad de las Acciones Formativas" (Orden TAS 2307/2007).

Todos los Excel exportados contienen **exactamente 45 columnas**, ni una más ni una menos.

---

## Acceso de Usuarios del Equipo

### Cuentas Disponibles

El sistema dispone de las siguientes cuentas para el equipo:

#### Cuentas de Administrador (acceso completo)

| Usuario | Email | Rol |
|---------|-------|-----|
| Admin Principal | test@test.eu | Administrador |
| Admin NMD 00 | nmd_00@verbadocpro.eu | Administrador |
| Admin NMD 000 | nmd_000@verbadocpro.eu | Administrador |

#### Cuentas de Revisor (equipo Normadat)

| Usuario | Email | Rol |
|---------|-------|-----|
| Usuario 1 | nmd_01@verbadocpro.eu | Revisor |
| Usuario 2 | nmd_02@verbadocpro.eu | Revisor |
| Usuario 3 | nmd_03@verbadocpro.eu | Revisor |
| Usuario 4 | nmd_04@verbadocpro.eu | Revisor |
| Usuario 5 | nmd_05@verbadocpro.eu | Revisor |

### Datos Compartidos

**Todos los usuarios comparten los mismos datos** independientemente de su rol:

- Los formularios procesados por cualquier usuario son visibles para todos
- El Excel Master muestra todos los registros del equipo
- Las estadísticas reflejan el trabajo conjunto del equipo
- El panel de Revisión muestra documentos pendientes de todo el equipo

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATOS COMPARTIDOS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ADMINISTRADORES        │         REVISORES                   │
│   ───────────────        │         ─────────                   │
│   test@test.eu      ─────┼────►  nmd_01                        │
│   nmd_00            ─────┼────►  nmd_02                        │
│   nmd_000           ─────┼────►  nmd_03                        │
│                          │       nmd_04                        │
│                          │       nmd_05                        │
│                          │                                     │
│            TODOS VEN LOS MISMOS DATOS                          │
└─────────────────────────────────────────────────────────────────┘
```

### Cómo Acceder

1. Ve a **https://www.verbadocpro.eu**
2. Introduce tu email: `nmd_XX@verbadocpro.eu` (donde XX es tu número)
3. Introduce la contraseña proporcionada por el administrador
4. Accederás al panel con todos los datos del equipo

### Funcionalidades por Rol

#### Administradores (test@test.eu, nmd_00, nmd_000)

| Acción | Permitido |
|--------|-----------|
| Ver todos los formularios procesados | ✅ Sí |
| Ver el Excel Master completo | ✅ Sí |
| Descargar Excel (45 columnas) | ✅ Sí |
| Revisar y corregir formularios | ✅ Sí |
| Enviar formularios a revisión | ✅ Sí |
| Aprobar formularios revisados | ✅ Sí |
| Subir nuevos PDFs para procesar | ✅ Sí |
| Ver documentos rechazados | ✅ Sí |
| Acceso al panel de administración | ✅ Sí |
| Gestión de configuración | ✅ Sí |
| Eliminar registros (con PIN) | ✅ Sí |

#### Revisores (nmd_01 a nmd_05)

| Acción | Permitido |
|--------|-----------|
| Ver todos los formularios procesados | ✅ Sí |
| Ver el Excel Master completo | ✅ Sí |
| Descargar Excel (45 columnas) | ✅ Sí |
| Revisar y corregir formularios | ✅ Sí |
| Enviar formularios a revisión | ✅ Sí |
| Aprobar formularios revisados | ✅ Sí |
| Subir nuevos PDFs para procesar | ✅ Sí |
| Ver documentos rechazados | ✅ Sí |
| Acceso al panel de administración | ❌ No |
| Gestión de configuración | ❌ No |
| Eliminar registros | ❌ No |

### Flujo de Trabajo Recomendado

1. **Inicio de sesión** → Accede con tu cuenta nmd_XX
2. **Panel principal** → Revisa las estadísticas del equipo
3. **Revisión** → Corrige formularios con errores de validación
4. **Excel Master** → Descarga el Excel cuando esté completo
5. **Cierre** → Cierra sesión al terminar

### Notas Importantes

- **No compartas tu contraseña** con personas fuera del equipo
- Los cambios que hagas **son visibles inmediatamente** para el resto del equipo
- Si detectas un error en un formulario, **corrígelo** para que todos vean la versión correcta
- El Excel descargado incluirá **todos los formularios aprobados** del equipo

---

## Las 45 Columnas del Excel

### Sección I: Datos Identificativos (Columnas A-G)

| Columna | Nombre | Descripción |
|---------|--------|-------------|
| A | Nº Expediente | Número de expediente FUNDAE (ej: F240001) |
| B | Perfil | Tipo de formación: B (Bonificada), etc. |
| C | CIF Empresa | CIF de la empresa (9 caracteres) |
| D | Nº Acción | Número de la acción formativa |
| E | Nº Grupo | Número del grupo |
| F | Denominación AAFF | Nombre completo del curso |
| G | Modalidad | Presencial / Teleformación / Mixta |

### Sección II: Datos del Participante (Columnas H-Q)

| Columna | Nombre | Descripción |
|---------|--------|-------------|
| H | Edad | Edad del participante (16-99) |
| I | Sexo | 1=Mujer, 2=Varón, 9=No contesta |
| J | Titulación | Nivel de estudios del participante |
| K | Código Titulación | Código numérico de la titulación |
| L | Lugar Trabajo | Provincia donde trabaja |
| M | Categoría Profesional | 1-6 según categoría, 9=No contesta |
| N | Cat. Prof. Otra | Si marcó "Otra", especifica cuál |
| O | Horario Curso | 1=Dentro jornada, 2=Fuera, 3=Ambas, 9=NC |
| P | % Jornada | Porcentaje de jornada laboral |
| Q | Tamaño Empresa | Según número de trabajadores |

### Sección III: Valoraciones (Columnas R-AP)

Todas las valoraciones usan escala **1-4**:
- 1 = Completamente en desacuerdo
- 2 = En desacuerdo
- 3 = De acuerdo
- 4 = Completamente de acuerdo

#### Organización del Curso (R-S)
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| R | Val 1.1 Organización | El curso ha estado bien organizado |
| S | Val 1.2 Nº Alumnos | El número de alumnos ha sido adecuado |

#### Contenidos y Metodología (T-U)
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| T | Val 2.1 Contenidos | Los contenidos responden a necesidades |
| U | Val 2.2 Teoría/Práctica | Combinación teoría/práctica adecuada |

#### Duración y Horario (V-W)
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| V | Val 3.1 Duración | La duración ha sido suficiente |
| W | Val 3.2 Horario | El horario favorece la asistencia |

#### Formadores y Tutores (X-AA)
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| X | Val 4.1 Formadores | Forma de impartir/explicar (Formadores) |
| Y | Val 4.1 Tutores | Forma de tutorizar (Tutores) |
| Z | Val 4.2 Formadores | Conocen la materia (Formadores) |
| AA | Val 4.2 Tutores | Conocen la materia (Tutores) |

#### Medios Didácticos (AB-AC)
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| AB | Val 5.1 Documentación | Documentación clara y comprensible |
| AC | Val 5.2 Medios Actualizados | Los medios están actualizados |

#### Instalaciones (AD-AE)
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| AD | Val 6.1 Instalaciones | Las instalaciones son apropiadas |
| AE | Val 6.2 Medios Técnicos | Los medios técnicos son adecuados |

#### Teleformación (AF-AG) - Solo para cursos online/mixtos
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| AF | Val 7.1 Guías Tutoriales | Las guías tutoriales son útiles |
| AG | Val 7.2 Medios Apoyo | Los medios de apoyo son suficientes |

#### Evaluación (AH-AI) - Respuestas Sí/No
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| AH | Val 8.1 Pruebas Evaluación | ¿Se realizaron pruebas de evaluación? |
| AI | Val 8.2 Acreditación | ¿Se entrega diploma/acreditación? |

#### Valoración General (AJ-AN)
| Columna | Nombre | Pregunta |
|---------|--------|----------|
| AJ | Val 9.1 Mercado Trabajo | Mejora incorporación al mercado |
| AK | Val 9.2 Habilidades | Nuevas habilidades aplicables |
| AL | Val 9.3 Cambio Puesto | Mejora posibilidades de cambio |
| AM | Val 9.4 Conocimientos | Ampliado conocimientos |
| AN | Val 9.5 Desarrollo Personal | Favorecido desarrollo personal |

#### Satisfacción Final (AO-AP)
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| AO | Satisfacción General | Grado de satisfacción global (1-4) |
| AP | Recomendaría | ¿Recomendaría este curso? (Sí/No) |

### Campos Adicionales (AQ-AS)

| Columna | Nombre | Descripción |
|---------|--------|-------------|
| AQ | Sugerencias | Comentarios del participante |
| AR | Fecha | Fecha de cumplimentación (DD/MM/YYYY) |
| AS | Registro Entrada | Número de registro FUNDAE |

---

## Cómo Descargar el Excel

### Desde Excel Master

1. Ve a la sección **Excel Master** en el menú principal
2. Haz clic en el botón **"Descargar Excel"**
3. Se descargará un archivo `FUNDAE_Master_FECHA.xlsx`

### Desde Sincronización

1. El sistema puede generar automáticamente Excel de sincronización
2. Nombre del archivo: `FUNDAE_Sync_FECHA.xlsx`
3. Contiene las mismas 45 columnas

---

## Verificación del Excel

Cada Excel descargado incluye una hoja **"Metadata"** con:

- Usuario que generó el archivo
- Total de filas (formularios)
- **Total de columnas: 45** (siempre)
- Fecha de generación
- Estadísticas por estado

### Comprobación Rápida

Para verificar que tu Excel es correcto:

1. Abre el archivo en Excel
2. La última columna con datos debe ser **AS** (columna 45)
3. La hoja "Metadata" debe mostrar "Total columnas: 45"

---

## Protección del Sistema

El sistema incluye **3 niveles de protección** para garantizar siempre 45 columnas:

| Nivel | Momento | Acción |
|-------|---------|--------|
| 1 | Al iniciar el servidor | Error si la configuración no tiene 45 columnas |
| 2 | Al solicitar descarga | Bloquea si detecta problema en columnas |
| 3 | Antes de generar | Validación final antes de crear el archivo |

Si alguna validación falla, el sistema **no genera el Excel** y muestra un mensaje de error.

---

## Preguntas Frecuentes

### ¿Por qué exactamente 45 columnas?

El formato está definido por la **Orden TAS 2307/2007** que establece el "Cuestionario para la Evaluación de la Calidad de las Acciones Formativas". Cada columna corresponde a un campo del formulario oficial.

### ¿Qué pasa si un campo está vacío?

Si el sistema no pudo extraer un dato del PDF, la celda aparecerá vacía. Esto es preferible a inventar datos incorrectos.

### ¿Puedo modificar las columnas?

No. El sistema está bloqueado para generar siempre exactamente 45 columnas. Esto garantiza compatibilidad con FUNDAE.

### ¿Los registros en revisión aparecen en el Excel?

No. Los registros que están en el panel de "Revisión" no se incluyen en el Excel hasta que sean aprobados.

### ¿Cómo sé si un Excel antiguo tiene el formato correcto?

Comprueba que la última columna con datos sea la **AS** (columna 45). Si termina antes, el Excel tiene formato antiguo y debe regenerarse.

---

## Resumen Visual

```
Excel FUNDAE - 45 Columnas (A → AS)
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│  IDENTIFICATIVOS (A-G)     │  7 columnas                       │
│  Expediente, CIF, Acción, Grupo, AAFF, Modalidad               │
├─────────────────────────────────────────────────────────────────┤
│  PARTICIPANTE (H-Q)        │  10 columnas                      │
│  Edad, Sexo, Titulación, Lugar, Categoría, Horario, etc.       │
├─────────────────────────────────────────────────────────────────┤
│  VALORACIONES (R-AP)       │  25 columnas                      │
│  Organización, Contenidos, Duración, Formadores, Medios...     │
├─────────────────────────────────────────────────────────────────┤
│  ADICIONALES (AQ-AS)       │  3 columnas                       │
│  Sugerencias, Fecha, Registro                                  │
└─────────────────────────────────────────────────────────────────┘

                    TOTAL: 45 COLUMNAS EXACTAS
```

---

## Contacto y Soporte

Si detectas algún problema con el formato del Excel o las columnas no coinciden:

1. Verifica que estás usando la última versión de la aplicación
2. Intenta descargar de nuevo el Excel
3. Contacta con soporte técnico si el problema persiste

---

*Última actualización: Enero 2026*
*Versión del formato: FUNDAE Oficial (Orden TAS 2307/2007)*
